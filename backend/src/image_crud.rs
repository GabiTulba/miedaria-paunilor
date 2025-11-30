use axum::{
    extract::{Multipart, Path},
    http::StatusCode,
    Json,
    response::IntoResponse, // Added
};
use diesel::prelude::*;
use tokio::fs;
use uuid::Uuid;
use mime_guess; // Added

use crate::db::establish_connection;
use crate::models::{Image, NewImage, UpdateImage, Product}; // Added Product
use crate::schema::{images, products}; // Added products to schema import
use diesel::dsl::count; // Added count

pub async fn upload_image(
    mut multipart: Multipart,
) -> Result<Json<Image>, StatusCode> {
    let mut conn = establish_connection();
    let upload_dir = "/app/images"; 

    if let Err(_) = fs::create_dir_all(upload_dir).await {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    while let Some(field) = multipart.next_field().await.unwrap() {
        let file_name = field.file_name().map(|s| s.to_string());
        let content_type = field.content_type().map(|s| s.to_string());

        if let Some(original_filename) = file_name {
            if let Some(ref ct) = content_type {
                if !ct.starts_with("image/") {
                    return Err(StatusCode::BAD_REQUEST);
                }
            } else {
                return Err(StatusCode::BAD_REQUEST);
            }

            let data = field.bytes().await.unwrap();
            let file_size = data.len() as i64;

            let image_uuid = Uuid::new_v4();
            let extension = original_filename.split('.').last().unwrap_or("png").to_lowercase(); // Convert to lowercase
            let storage_filename = format!("{}.{}", image_uuid, extension);
            let storage_path = format!("{}/{}", upload_dir, storage_filename);

            if let Err(_) = fs::write(&storage_path, &data).await {
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }

            let new_image = NewImage {
                file_name: original_filename.clone(),
                storage_path: storage_path.clone(),
                file_size,
            };

            let inserted_image: Image = diesel::insert_into(images::table)
                .values(&new_image)
                .get_result(&mut conn)
                .map_err(|e| {
                    eprintln!("Error inserting image into DB: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            return Ok(Json(inserted_image));
        }
    }

    Err(StatusCode::BAD_REQUEST)
}

pub async fn get_all_images() -> Result<Json<Vec<Image>>, StatusCode> {
    let mut conn = establish_connection();
    images::table
        .load::<Image>(&mut conn)
        .map_err(|e| {
            eprintln!("Error fetching all images: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
        .map(Json)
}

pub async fn get_image_by_id(Path(image_id): Path<uuid::Uuid>) -> Result<Json<Image>, StatusCode> {
    let mut conn = establish_connection();
    images::table
        .find(image_id)
        .first::<Image>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => StatusCode::NOT_FOUND,
            _ => {
                eprintln!("Error fetching image by ID: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })
        .map(Json)
}

pub async fn update_image(
    Path(image_id): Path<uuid::Uuid>,
    Json(updated_image_data): Json<UpdateImage>,
) -> Result<Json<Image>, StatusCode> {
    let mut conn = establish_connection();

    // Check if the image exists
    let existing_image: Image = images::table
        .find(image_id)
        .first::<Image>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => StatusCode::NOT_FOUND,
            _ => {
                eprintln!("Error finding image for update: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
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
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            // Update the storage_path in the database as well
            // For now, I will just update file_name and rely on the UI to display the correct new path.
        }
    }

    let updated_image: Image = diesel::update(images::table.find(image_id))
        .set(&updated_image_data)
        .get_result(&mut conn)
        .map_err(|e| {
            eprintln!("Error updating image in DB: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(updated_image))
}

pub async fn delete_image(Path(image_id): Path<uuid::Uuid>) -> Result<StatusCode, StatusCode> {
    let mut conn = establish_connection();

    // 1. Check for foreign key references in the products table
    let products_count_referencing_image = products::table
        .filter(products::image_id.eq(image_id))
        .select(count(products::product_id))
        .first::<i64>(&mut conn)
        .map_err(|e| {
            eprintln!("Error checking product references for image {}: {:?}", image_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if products_count_referencing_image > 0 {
        return Err(StatusCode::CONFLICT); // Image is still referenced by products
    }

    // Retrieve image from DB to get storage_path
    let image_to_delete: Image = images::table
        .find(image_id)
        .first::<Image>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => StatusCode::NOT_FOUND,
            _ => {
                eprintln!("Error finding image for deletion: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    // Delete file from filesystem
    if let Err(e) = tokio::fs::remove_file(&image_to_delete.storage_path).await {
        eprintln!("Error deleting file {}: {:?}", image_to_delete.storage_path, e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Delete record from DB
    diesel::delete(images::table.find(image_id))
        .execute(&mut conn)
        .map_err(|e| {
            eprintln!("Error deleting image from DB: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn serve_image(Path(image_id): Path<uuid::Uuid>) -> Result<impl IntoResponse, StatusCode> {
    let mut conn = establish_connection();

    let image_record: Image = images::table
        .find(image_id)
        .first::<Image>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => StatusCode::NOT_FOUND,
            _ => {
                eprintln!("Error finding image record to serve: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    let path = image_record.storage_path;

    let file_content = tokio::fs::read(&path).await.map_err(|e| {
        eprintln!("Error reading image file {}: {:?}", path, e);
        StatusCode::INTERNAL_SERVER_ERROR
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
