use axum::{Json, extract::Multipart, http::StatusCode};
use diesel::prelude::*;
use image::imageops::FilterType;
use mime_guess;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

use crate::AppError;
use crate::models::{Image, NewImage, UpdateImage, UpdateImageInternal};
use crate::schema::{images, products};
use diesel::dsl::count;
use diesel::pg::PgConnection;

const MAX_IMAGE_SIZE: usize = 50 * 1024 * 1024; // 50MB
const MAX_DECODED_PIXELS: u32 = 8000;
const MAX_DECODE_ALLOC: u64 = 256 * 1024 * 1024;

pub const VARIANT_WIDTHS: [u32; 4] = [320, 640, 1024, 1600];
const WEBP_QUALITY: f32 = 80.0;

/// Decodes an in-memory image with bounded width/height and allocation budget,
/// to defuse decompression-bomb payloads (small file, huge decoded buffer).
fn decode_with_limits(data: &[u8]) -> Result<image::DynamicImage, image::ImageError> {
    let reader = image::ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(image::ImageError::IoError)?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(MAX_DECODED_PIXELS);
    limits.max_image_height = Some(MAX_DECODED_PIXELS);
    limits.max_alloc = Some(MAX_DECODE_ALLOC);
    let mut reader = reader;
    reader.limits(limits);
    reader.decode()
}

/// Build the on-disk path for a width variant given the original storage path.
/// `/uploads/{uuid}.jpg` + width 640 → `/uploads/{uuid}_640.webp`
fn variant_path(original: &str, width: u32) -> PathBuf {
    let p = Path::new(original);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    let parent = p.parent().unwrap_or_else(|| Path::new(""));
    parent.join(format!("{}_{}.webp", stem, width))
}

/// Encode width-variant WebPs next to the original. Skips widths >= source width
/// (no upscaling). Best-effort: errors are logged and don't fail the upload.
fn generate_variants(img: &image::DynamicImage, storage_path: &str) {
    let src_w = img.width();

    for &target_w in VARIANT_WIDTHS.iter().filter(|&&tw| tw < src_w) {
        let resized = img.resize(target_w, u32::MAX, FilterType::Lanczos3);
        let rgba = resized.to_rgba8();
        let encoder = webp::Encoder::from_rgba(&rgba, resized.width(), resized.height());
        let webp_bytes = encoder.encode(WEBP_QUALITY);
        let path = variant_path(storage_path, target_w);
        if let Err(e) = std::fs::write(&path, &*webp_bytes) {
            tracing::warn!("Failed to write variant {}: {:?}", path.display(), e);
        }
    }
}

/// Detects image format from magic bytes. Returns canonical extension or None if not a known image.
fn detect_image_format(data: &[u8]) -> Option<&'static str> {
    if data.len() < 12 {
        return None;
    }
    if data.starts_with(b"\xFF\xD8\xFF") {
        return Some("jpg");
    }
    if data.starts_with(b"\x89PNG\r\n\x1A\n") {
        return Some("png");
    }
    if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        return Some("gif");
    }
    if data.starts_with(b"RIFF") && &data[8..12] == b"WEBP" {
        return Some("webp");
    }
    if data.starts_with(b"BM") {
        return Some("bmp");
    }
    if data.starts_with(b"II\x2A\x00") || data.starts_with(b"MM\x00\x2A") {
        return Some("tiff");
    }
    None
}

pub async fn upload_image(
    conn: &mut PgConnection,
    mut multipart: Multipart,
    upload_dir: &str,
) -> Result<Json<Image>, AppError> {

    if let Err(e) = fs::create_dir_all(&upload_dir).await {
        tracing::error!("Error creating upload directory: {:?}", e);
        return Err(AppError::InternalServerError(
            "Failed to create upload directory".to_string(),
        ));
    }

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Error reading multipart field: {:?}", e);
        AppError::BadRequest("Invalid multipart request".to_string())
    })? {
        let file_name = field.file_name().map(|s| s.to_string());

        if let Some(original_filename) = file_name {
            let data = field.bytes().await.map_err(|e| {
                tracing::error!("Error reading file bytes: {:?}", e);
                AppError::InternalServerError("Failed to read file data".to_string())
            })?;

            if data.len() > MAX_IMAGE_SIZE {
                return Err(AppError::BadRequest(
                    "File too large. Maximum image size is 50MB.".to_string(),
                ));
            }

            // Validate by magic bytes — client-supplied content-type and extension are untrusted
            let extension = detect_image_format(&data).ok_or_else(|| {
                AppError::BadRequest(
                    "Invalid file. Only JPEG, PNG, GIF, WebP, BMP, and TIFF images are allowed."
                        .to_string(),
                )
            })?;

            // Magic bytes only confirm the header; fully decode (with size/alloc
            // limits) so polyglot files and decompression bombs can't slip past.
            let decoded = decode_with_limits(&data).map_err(|e| {
                tracing::warn!("Image decode rejected: {:?}", e);
                AppError::BadRequest("Invalid or oversized image file.".to_string())
            })?;

            let file_size = data.len() as i64;
            let image_uuid = Uuid::new_v4();
            let storage_filename = format!("{}.{}", image_uuid, extension);
            let storage_path = format!("{}/{}", upload_dir, storage_filename);

            if let Err(e) = fs::write(&storage_path, &data).await {
                tracing::error!("Error writing file to disk: {:?}", e);
                return Err(AppError::InternalServerError(
                    "Failed to write image file to disk".to_string(),
                ));
            }

            generate_variants(&decoded, &storage_path);

            let new_image = NewImage {
                file_name: original_filename.clone(),
                storage_path: storage_path.clone(),
                file_size,
            };

            let inserted_image: Image = diesel::insert_into(images::table)
                .values(&new_image)
                .get_result(conn)
                .map_err(|e| {
                    tracing::error!("Error inserting image into DB: {:?}", e);
                    AppError::InternalServerError(
                        "Failed to save image metadata to database".to_string(),
                    )
                })?;

            return Ok(Json(inserted_image));
        }
    }

    Err(AppError::BadRequest(
        "No file found in multipart upload".to_string(),
    ))
}

pub async fn get_all_images(conn: &mut PgConnection) -> Result<Json<Vec<Image>>, AppError> {
    images::table
        .load::<Image>(conn)
        .map_err(|e| {
            tracing::error!("Error fetching all images: {:?}", e);
            AppError::InternalServerError("Failed to fetch all images".to_string())
        })
        .map(Json)
}

pub async fn get_image_by_id(
    conn: &mut PgConnection,
    image_id: uuid::Uuid,
) -> Result<Json<Image>, AppError> {
    images::table
        .find(image_id)
        .first::<Image>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::NotFound(format!("Image with id {} not found", image_id))
            }
            _ => {
                tracing::error!("Error fetching image by ID: {:?}", e);
                AppError::InternalServerError("Failed to fetch image by ID".to_string())
            }
        })
        .map(Json)
}

pub async fn update_image(
    conn: &mut PgConnection,
    image_id: uuid::Uuid,
    updated_image_data: UpdateImage,
    upload_dir: &str,
) -> Result<Json<Image>, AppError> {
    // Check if the image exists
    let existing_image: Image = images::table
        .find(image_id)
        .first::<Image>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                AppError::NotFound(format!("Image with id {} not found", image_id))
            }
            _ => {
                tracing::error!("Error finding image for update: {:?}", e);
                AppError::InternalServerError("Failed to find image for update".to_string())
            }
        })?;

    // The on-disk filename is `{image_id}.{ext}`, derived server-side from the
    // image UUID. We never let the caller dictate `storage_path` — see
    // `UpdateImageInternal` doc comment.
    let mut changeset = UpdateImageInternal {
        file_name: updated_image_data.file_name.clone(),
        storage_path: None,
    };

    if let Some(new_file_name) = updated_image_data.file_name.as_ref() {
        if new_file_name != &existing_image.file_name {
            let old_storage_path = &existing_image.storage_path;
            let extension = Path::new(old_storage_path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("png");
            let new_storage_filename = format!("{}.{}", image_id, extension);
            let new_storage_path = format!("{}/{}", upload_dir, new_storage_filename);

            if old_storage_path != &new_storage_path {
                if let Err(e) = tokio::fs::rename(old_storage_path, &new_storage_path).await {
                    tracing::error!(
                        "Error renaming file from {} to {}: {:?}",
                        old_storage_path, new_storage_path, e
                    );
                    return Err(AppError::InternalServerError(
                        "Failed to rename image file".to_string(),
                    ));
                }
                changeset.storage_path = Some(new_storage_path);
            }
        }
    }

    let updated_image: Image = diesel::update(images::table.find(image_id))
        .set(&changeset)
        .get_result(conn)
        .map_err(|e| {
            tracing::error!("Error updating image in DB: {:?}", e);
            AppError::InternalServerError("Failed to update image metadata in database".to_string())
        })?;

    Ok(Json(updated_image))
}

pub async fn delete_image(
    conn: &mut PgConnection,
    image_id: uuid::Uuid,
) -> Result<StatusCode, AppError> {
    // 1. Check for foreign key references in the products table
    let products_count_referencing_image = products::table
        .filter(products::image_id.eq(image_id))
        .select(count(products::product_id))
        .first::<i64>(conn)
        .map_err(|e| {
            tracing::error!(
                "Error checking product references for image {}: {:?}",
                image_id, e
            );
            AppError::InternalServerError(
                "Failed to check product references for image".to_string(),
            )
        })?;

    if products_count_referencing_image > 0 {
        return Err(AppError::BadRequest(
            "Image is currently referenced by one or more products and cannot be deleted."
                .to_string(),
        ));
    }

    // Retrieve image from DB to get storage_path
    let image_to_delete: Image =
        images::table
            .find(image_id)
            .first::<Image>(conn)
            .map_err(|e| match e {
                diesel::result::Error::NotFound => {
                    AppError::NotFound(format!("Image with id {} not found", image_id))
                }
                _ => {
                    tracing::error!("Error finding image for deletion: {:?}", e);
                    AppError::InternalServerError("Failed to find image for deletion".to_string())
                }
            })?;

    // Delete file from filesystem
    if let Err(e) = tokio::fs::remove_file(&image_to_delete.storage_path).await {
        if e.kind() == std::io::ErrorKind::NotFound {
            tracing::warn!(
                "Image file {} not found on filesystem but record exists in DB. Proceeding with DB deletion.",
                image_to_delete.storage_path
            );
        } else {
            tracing::error!(
                "Error deleting file {}: {:?}",
                image_to_delete.storage_path, e
            );
            return Err(AppError::InternalServerError(
                "Failed to delete image file from filesystem".to_string(),
            ));
        }
    }

    // Best-effort cleanup of width-variant files; missing files are fine.
    for &w in VARIANT_WIDTHS.iter() {
        let path = variant_path(&image_to_delete.storage_path, w);
        if let Err(e) = tokio::fs::remove_file(&path).await {
            if e.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!("Failed to delete variant {}: {:?}", path.display(), e);
            }
        }
    }

    // Delete record from DB
    diesel::delete(images::table.find(image_id))
        .execute(conn)
        .map_err(|e| {
            tracing::error!("Error deleting image from DB: {:?}", e);
            AppError::InternalServerError("Failed to delete image record from database".to_string())
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Best-effort removal of width-variant WebPs for an image. Used to reclaim
/// disk when a product is soft-deleted (the original is preserved so the
/// image can be reused if the product is restored).
pub async fn delete_image_variants(storage_path: &str) {
    for &w in VARIANT_WIDTHS.iter() {
        let path = variant_path(storage_path, w);
        if let Err(e) = tokio::fs::remove_file(&path).await {
            if e.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!("Failed to delete variant {}: {:?}", path.display(), e);
            }
        }
    }
}

pub async fn serve_image(
    conn: &mut PgConnection,
    image_id: uuid::Uuid,
    width: Option<u32>,
) -> Result<(axum::http::HeaderMap, Vec<u8>), AppError> {
    let image_record: Image =
        images::table
            .find(image_id)
            .first::<Image>(conn)
            .map_err(|e| match e {
                diesel::result::Error::NotFound => {
                    AppError::NotFound(format!("Image with id {} not found", image_id))
                }
                _ => {
                    tracing::error!("Error finding image record to serve: {:?}", e);
                    AppError::InternalServerError(
                        "Failed to find image record to serve".to_string(),
                    )
                }
            })?;

    // If a known width is requested and the variant exists on disk, serve it.
    // Unknown widths are rejected; missing variant files fall back to the original.
    let (path, served_variant) = match width {
        None => (image_record.storage_path.clone(), false),
        Some(w) if VARIANT_WIDTHS.contains(&w) => {
            let vpath = variant_path(&image_record.storage_path, w);
            if tokio::fs::try_exists(&vpath).await.unwrap_or(false) {
                (vpath.to_string_lossy().into_owned(), true)
            } else {
                (image_record.storage_path.clone(), false)
            }
        }
        Some(w) => {
            return Err(AppError::BadRequest(format!(
                "Unsupported image width: {}. Allowed: {:?}",
                w, VARIANT_WIDTHS
            )));
        }
    };

    let file_content = tokio::fs::read(&path).await.map_err(|e| {
        tracing::error!("Error reading image file {}: {:?}", path, e);
        AppError::InternalServerError("Failed to read image file".to_string())
    })?;

    let mime_type = if served_variant {
        "image/webp".to_string()
    } else {
        mime_guess::from_path(&path)
            .first_or_octet_stream()
            .as_ref()
            .to_string()
    };

    Ok((
        axum::http::HeaderMap::from_iter(vec![
            (
                axum::http::header::CONTENT_TYPE,
                mime_type.parse().unwrap(),
            ),
            (
                axum::http::header::CACHE_CONTROL,
                "public, max-age=31536000, immutable".parse().unwrap(),
            ),
        ]),
        file_content,
    ))
}
