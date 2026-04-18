use axum::{Json, extract::Multipart, http::StatusCode};
use diesel::prelude::*;
use mime_guess;
use tokio::fs;
use uuid::Uuid;

use crate::AppError;
use crate::models::{Image, NewImage, UpdateImage};
use crate::schema::{images, products};
use diesel::dsl::count;
use diesel::pg::PgConnection;

const MAX_IMAGE_SIZE: usize = 50 * 1024 * 1024; // 50MB

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
) -> Result<Json<Image>, AppError> {
    let upload_dir = std::env::var("IMAGE_UPLOAD_DIR").expect("IMAGE_UPLOAD_DIR must be set");

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
    mut updated_image_data: UpdateImage,
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

    // If file_name is updated, rename the file on the filesystem
    if let Some(new_file_name) = updated_image_data.file_name.clone() {
        if new_file_name != existing_image.file_name {
            let old_storage_path = existing_image.storage_path;
            let upload_dir = std::env::var("IMAGE_UPLOAD_DIR")
                .map_err(|_| AppError::InternalServerError("IMAGE_UPLOAD_DIR not set".to_string()))?;
            let extension = old_storage_path.split('.').last().unwrap_or("png");
            let new_storage_filename = format!("{}.{}", image_id, extension);
            let new_storage_path = format!("{}/{}", upload_dir, new_storage_filename);

            if let Err(e) = tokio::fs::rename(&old_storage_path, &new_storage_path).await {
                tracing::error!(
                    "Error renaming file from {} to {}: {:?}",
                    old_storage_path, new_storage_path, e
                );
                return Err(AppError::InternalServerError(
                    "Failed to rename image file".to_string(),
                ));
            }
            // Update the storage_path in the database as well
            updated_image_data.storage_path = Some(new_storage_path);
        }
    }

    let updated_image: Image = diesel::update(images::table.find(image_id))
        .set(&updated_image_data)
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

    // Delete record from DB
    diesel::delete(images::table.find(image_id))
        .execute(conn)
        .map_err(|e| {
            tracing::error!("Error deleting image from DB: {:?}", e);
            AppError::InternalServerError("Failed to delete image record from database".to_string())
        })?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn serve_image(
    conn: &mut PgConnection,
    image_id: uuid::Uuid,
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

    let path = image_record.storage_path;

    let file_content = tokio::fs::read(&path).await.map_err(|e| {
        tracing::error!("Error reading image file {}: {:?}", path, e);
        AppError::InternalServerError("Failed to read image file".to_string())
    })?;

    let mime_type = mime_guess::from_path(&path).first_or_octet_stream();

    Ok((
        axum::http::HeaderMap::from_iter(vec![(
            axum::http::header::CONTENT_TYPE,
            mime_type.as_ref().parse().unwrap(),
        )]),
        file_content,
    ))
}
