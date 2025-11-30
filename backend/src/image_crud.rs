use axum::{
    extract::Multipart,
    http::StatusCode,
    Json,
};
use diesel::prelude::*;
use tokio::fs;
use uuid::Uuid;
use mime_guess;

use crate::models::{Image, NewImage, UpdateImage};
use crate::schema::{images, products};
use diesel::dsl::count;
use crate::AppError;
use diesel::pg::PgConnection;

pub async fn upload_image(
    conn: &mut PgConnection,
    mut multipart: Multipart,
) -> Result<Json<Image>, AppError> {
    let upload_dir = std::env::var("IMAGE_UPLOAD_DIR")
        .expect("IMAGE_UPLOAD_DIR must be set");

    if let Err(e) = fs::create_dir_all(&upload_dir).await {
        eprintln!("Error creating upload directory: {:?}", e);
        return Err(AppError::InternalServerError("Failed to create upload directory".to_string()));
    }

    while let Some(field) = multipart.next_field().await.unwrap() {
        let file_name = field.file_name().map(|s| s.to_string());
        let content_type = field.content_type().map(|s| s.to_string());

        if let Some(original_filename) = file_name {
            if let Some(ref ct) = content_type {
                if !ct.starts_with("image/") {
                    return Err(AppError::BadRequest("Invalid content type. Only image files are allowed.".to_string()));
                }
            } else {
                return Err(AppError::BadRequest("Missing content type for file upload.".to_string()));
            }

            let data = field.bytes().await.map_err(|e| {
                eprintln!("Error reading file bytes: {:?}", e);
                AppError::InternalServerError("Failed to read file data".to_string())
            })?;
            let file_size = data.len() as i64;

            let image_uuid = Uuid::new_v4();
            let extension = original_filename.split('.').last().unwrap_or("png").to_lowercase(); 
            let storage_filename = format!("{}.{}", image_uuid, extension);
            let storage_path = format!("{}/{}", upload_dir, storage_filename);

            if let Err(e) = fs::write(&storage_path, &data).await {
                eprintln!("Error writing file to disk: {:?}", e);
                return Err(AppError::InternalServerError("Failed to write image file to disk".to_string()));
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
                    eprintln!("Error inserting image into DB: {:?}", e);
                    AppError::InternalServerError("Failed to save image metadata to database".to_string())
                })?;

            return Ok(Json(inserted_image));
        }
    }

    Err(AppError::BadRequest("No file found in multipart upload".to_string()))
}

pub async fn get_all_images(conn: &mut PgConnection) -> Result<Json<Vec<Image>>, AppError> {
    images::table
        .load::<Image>(conn)
        .map_err(|e| {
            eprintln!("Error fetching all images: {:?}", e);
            AppError::InternalServerError("Failed to fetch all images".to_string())
        })
        .map(Json)
}

pub async fn get_image_by_id(conn: &mut PgConnection, image_id: uuid::Uuid) -> Result<Json<Image>, AppError> {
    images::table
        .find(image_id)
        .first::<Image>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound(format!("Image with id {} not found", image_id)),
            _ => {
                eprintln!("Error fetching image by ID: {:?}", e);
                AppError::InternalServerError("Failed to fetch image by ID".to_string())
            }
        })
        .map(Json)
}

pub async fn update_image(
    conn: &mut PgConnection,
    image_id: uuid::Uuid,
    updated_image_data: UpdateImage,
) -> Result<Json<Image>, AppError> {
    // Check if the image exists
    let existing_image: Image = images::table
        .find(image_id)
        .first::<Image>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound(format!("Image with id {} not found", image_id)),
            _ => {
                eprintln!("Error finding image for update: {:?}", e);
                AppError::InternalServerError("Failed to find image for update".to_string())
            }
        })?;

    // If file_name is updated, rename the file on the filesystem
    if let Some(new_file_name) = updated_image_data.file_name.clone() {
        if new_file_name != existing_image.file_name {
            let old_storage_path = existing_image.storage_path;
            let upload_dir = "/app/images";
            let extension = old_storage_path.split('.').last().unwrap_or("png");
            let new_storage_filename = format!("{}.{}", image_id, extension);
            let new_storage_path = format!("{}/{}", upload_dir, new_storage_filename);

            if let Err(e) = tokio::fs::rename(&old_storage_path, &new_storage_path).await {
                eprintln!("Error renaming file from {} to {}: {:?}", old_storage_path, new_storage_path, e);
                return Err(AppError::InternalServerError("Failed to rename image file".to_string()));
            }
            // Update the storage_path in the database as well
            // For now, I will just update file_name and rely on the UI to display the correct new path.
        }
    }

    let updated_image: Image = diesel::update(images::table.find(image_id))
        .set(&updated_image_data)
        .get_result(conn)
        .map_err(|e| {
            eprintln!("Error updating image in DB: {:?}", e);
            AppError::InternalServerError("Failed to update image metadata in database".to_string())
        })?;

    Ok(Json(updated_image))
}

pub async fn delete_image(conn: &mut PgConnection, image_id: uuid::Uuid) -> Result<StatusCode, AppError> {
    // 1. Check for foreign key references in the products table
    let products_count_referencing_image = products::table
        .filter(products::image_id.eq(image_id))
        .select(count(products::product_id))
        .first::<i64>(conn)
        .map_err(|e| {
            eprintln!("Error checking product references for image {}: {:?}", image_id, e);
            AppError::InternalServerError("Failed to check product references for image".to_string())
        })?;

    if products_count_referencing_image > 0 {
        return Err(AppError::BadRequest("Image is currently referenced by one or more products and cannot be deleted.".to_string())); 
    }

    // Retrieve image from DB to get storage_path
    let image_to_delete: Image = images::table
        .find(image_id)
        .first::<Image>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound(format!("Image with id {} not found", image_id)),
            _ => {
                eprintln!("Error finding image for deletion: {:?}", e);
                AppError::InternalServerError("Failed to find image for deletion".to_string())
            }
        })?;

    // Delete file from filesystem
    if let Err(e) = tokio::fs::remove_file(&image_to_delete.storage_path).await {
        eprintln!("Error deleting file {}: {:?}", image_to_delete.storage_path, e);
        return Err(AppError::InternalServerError("Failed to delete image file from filesystem".to_string()));
    }

    // Delete record from DB
    diesel::delete(images::table.find(image_id))
        .execute(conn)
        .map_err(|e| {
            eprintln!("Error deleting image from DB: {:?}", e);
            AppError::InternalServerError("Failed to delete image record from database".to_string())
        })?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn serve_image(conn: &mut PgConnection, image_id: uuid::Uuid) -> Result<(axum::http::HeaderMap, Vec<u8>), AppError> {
    let image_record: Image = images::table
        .find(image_id)
        .first::<Image>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound(format!("Image with id {} not found", image_id)),
            _ => {
                eprintln!("Error finding image record to serve: {:?}", e);
                AppError::InternalServerError("Failed to find image record to serve".to_string())
            }
        })?;

    let path = image_record.storage_path;

    let file_content = tokio::fs::read(&path).await.map_err(|e| {
        eprintln!("Error reading image file {}: {:?}", path, e);
        AppError::InternalServerError("Failed to read image file".to_string())
    })?;

    let mime_type = mime_guess::from_path(&path).first_or_octet_stream();

    Ok(
        (
            axum::http::HeaderMap::from_iter(vec![(
                axum::http::header::CONTENT_TYPE,
                mime_type.as_ref().parse().unwrap(),
            )]),
            file_content,
        )
    )
}
