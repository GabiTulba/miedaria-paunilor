use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use diesel::r2d2::ConnectionManager;
use dotenvy::dotenv;
use std::{env, net::SocketAddr, sync::Arc};

// Import everything from the backend library crate
use backend::{auth, models, product_crud, AppState, db};
use backend::image_crud;
use backend::product_crud::ProductWithImage;
use axum::extract::Extension; 
use axum::extract::Multipart; // Added for upload_image_handler
use backend::AppError; // Corrected AppError import

#[tokio::main]
async fn main() {
    dotenv().ok();

use tower_http::cors::CorsLayer;
use tower_http::cors::Any;

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<diesel::pg::PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.");

    let app_state = Arc::new(AppState { pool });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let admin_routes = Router::new()
        .route("/protected", get(protected_route))
        .route("/products", post(create_product))
        .route("/products/{product_id}", put(update_product))
        .route("/products/{product_id}", delete(delete_product))
        .route("/images", get(list_images))
        .route("/images", post(upload_image_handler)) // Updated to use wrapper
        .route("/images/{image_id}", put(update_image_meta_handler)) // Updated to use wrapper
        .route("/images/{image_id}", delete(delete_image_wrapper)) // Updated to use wrapper
        .route_layer(axum::middleware::from_fn_with_state(app_state.clone(), auth::auth_middleware))
        .layer(cors.clone());

    let app = Router::new()
        .route("/images/{image_id}", get(serve_image_handler)) // Updated to use wrapper
        .route("/health", get(health_check))
        .route("/api/products", get(get_all_products))
        .route("/api/products/{product_id}", get(get_product_by_id))
        .route("/api/admin/login", post(auth::login))
        .nest("/api/admin", admin_routes)
        .with_state(app_state)
        .layer(cors);

    let port = env::var("BACKEND_PORT")
        .expect("BACKEND_PORT must be set")
        .parse::<u16>()
        .expect("BACKEND_PORT must be a valid port number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("listening on {}", addr);
    axum::serve(listener, app.into_make_service()).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn upload_image_handler(
    State(app_state): State<Arc<AppState>>,
    multipart: Multipart,
) -> Result<Json<models::Image>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::upload_image(&mut conn, multipart).await
}

async fn serve_image_handler(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let (headers, content) = image_crud::serve_image(&mut conn, image_id).await?;
    Ok((headers, content))
}

async fn update_image_meta_handler(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
    Json(updated_image): Json<models::UpdateImage>,
) -> Result<Json<models::Image>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::update_image(&mut conn, image_id, updated_image).await
}

async fn delete_image_wrapper(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::delete_image(&mut conn, image_id).await
}

async fn get_all_products(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<ProductWithImage>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let products = product_crud::get_all_products(&mut conn)?;

    Ok(Json(products))
}

async fn get_product_by_id(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<ProductWithImage>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::get_product(&mut conn, &product_id)?
        .ok_or(AppError::NotFound(format!("Product with id {} not found", product_id)))?;

    Ok(Json(product))
}

async fn protected_route(Extension(claims): Extension<auth::Claims>) -> Result<String, StatusCode> {
    Ok(format!(
        "Welcome to the protected area, {}!",
        claims.sub
    ))
}

async fn create_product(
    State(app_state): State<Arc<AppState>>,
    Json(new_product): Json<models::NewProduct>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::create_product(&mut conn, &new_product)?;

    Ok(Json(product))
}

async fn update_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(mut product): Json<models::Product>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    product.product_id = product_id;

    let updated_product = product_crud::update_product(&mut conn, &product)?;

    Ok(Json(updated_product))
}

async fn delete_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    product_crud::delete_product(&mut conn, &product_id)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(AppError::from)
}


async fn list_images(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<models::Image>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::get_all_images(&mut conn).await
}