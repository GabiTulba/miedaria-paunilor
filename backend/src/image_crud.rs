use axum::{
    extract::{Multipart},
    http::StatusCode,
    Json,
};
use serde::Serialize; // Removed Deserialize
use tokio::fs;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ImageUploadResponse {
    pub filename: String,
    pub url: String,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

pub async fn upload_image(
    mut multipart: Multipart,
) -> Result<Json<ImageUploadResponse>, StatusCode> {
    let upload_dir = "/app/images"; // This path should match the volume mount in docker-compose.yml

    // Ensure the upload directory exists
    if let Err(_) = fs::create_dir_all(upload_dir).await {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    while let Some(field) = multipart.next_field().await.unwrap() {
        let _name = field.name().unwrap().to_string(); // Marked as unused for now
        let file_name = field.file_name().map(|s| s.to_string());
        let content_type = field.content_type().map(|s| s.to_string());

        if let Some(filename) = file_name {
            // Basic validation for image types (can be expanded)
            if let Some(ref ct) = content_type {
                if !ct.starts_with("image/") {
                    return Err(StatusCode::BAD_REQUEST); // Only allow image uploads
                }
            } else {
                return Err(StatusCode::BAD_REQUEST); // Must have a content type
            }

            let data = field.bytes().await.unwrap();

            let uuid = Uuid::new_v4().to_string();
            let extension = filename.split('.').last().unwrap_or("png"); // Default to png if no extension
            let new_filename = format!("{}.{}", uuid, extension);
            let filepath = format!("{}/{}", upload_dir, new_filename);

            if let Err(_) = fs::write(&filepath, &data).await {
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }

            // Construct the URL. Assuming Nginx will serve these from /images
            let image_url = format!("/images/{}", new_filename);

            return Ok(Json(ImageUploadResponse {
                filename: new_filename,
                url: image_url,
            }));
        }
    }

    Err(StatusCode::BAD_REQUEST)
}
