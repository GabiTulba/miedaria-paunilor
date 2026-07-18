use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
};

use crate::AppError;
use crate::AppState;
use crate::db;
use crate::image_crud;
use crate::models;

#[derive(Debug, serde::Deserialize)]
struct ServeImageQuery {
    w: Option<u32>,
}

async fn upload_image_handler(
    State(app_state): State<Arc<AppState>>,
    multipart: Multipart,
) -> Result<Json<models::Image>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::upload_image(&mut conn, multipart, &app_state.image_upload_dir).await
}

async fn serve_image_handler(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
    Query(params): Query<ServeImageQuery>,
) -> Result<impl IntoResponse, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let (headers, content) = image_crud::serve_image(&mut conn, image_id, params.w).await?;
    Ok((headers, content))
}

async fn update_image_meta_handler(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
    Json(updated_image): Json<models::UpdateImage>,
) -> Result<Json<models::Image>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::update_image(
        &mut conn,
        image_id,
        updated_image,
        &app_state.image_upload_dir,
    )
    .await
}

async fn delete_image_wrapper(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::delete_image(&mut conn, image_id).await
}

async fn list_images(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<models::Image>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::get_all_images(&mut conn).await
}

/// Public image-serve route. Mounted at the top level (not under `/api`) and
/// rate-limited separately from the regular public API.
pub fn public_serve_router() -> Router<Arc<AppState>> {
    Router::new().route("/images/{image_id}", get(serve_image_handler))
}

/// Admin image CRUD. The upload route gets a 50MB body-limit override; every
/// other admin route inherits the global 256KB cap.
pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/images", get(list_images))
        .route(
            "/images",
            post(upload_image_handler).layer(DefaultBodyLimit::max(52_428_800)),
        )
        .route("/images/{image_id}", put(update_image_meta_handler))
        .route("/images/{image_id}", delete(delete_image_wrapper))
}
