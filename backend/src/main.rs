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
use backend::{auth, models, product_crud, AppState};


#[tokio::main]
async fn main() {
    dotenv().ok();

use tower_http::cors::CorsLayer;
use tower_http::cors::Any; // Or specific origins

// ... inside main() function

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<diesel::pg::PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.");

    let app_state = Arc::new(AppState { pool });

    let cors = CorsLayer::new()
        .allow_origin(Any) // For development, allow all origins
        .allow_methods(Any) // Allow all methods
        .allow_headers(Any); // Allow all headers

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/products", get(get_all_products))
        .route("/api/products/{product_id}", get(get_product_by_id))
        .route("/api/admin/login", post(auth::login))
        .route("/api/admin/protected", get(protected_route))
        .route("/api/admin/products", post(create_product))
        .route("/api/admin/products/{product_id}", put(update_product))
        .route("/api/admin/products/{product_id}", delete(delete_product))
        .with_state(app_state)
        .layer(cors); // Apply CORS middleware

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("listening on {}", addr);
    axum::serve(listener, app.into_make_service()).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn get_all_products(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<models::Product>>, StatusCode> {
    let mut conn = app_state
        .pool
        .get()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let products = product_crud::get_all_products(&mut conn)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(products))
}

async fn get_product_by_id(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<models::Product>, StatusCode> {
    let mut conn = app_state
        .pool
        .get()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let product = product_crud::get_product(&mut conn, &product_id)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(product))
}

async fn protected_route(claims: auth::Claims) -> Result<String, StatusCode> {
    Ok(format!(
        "Welcome to the protected area, {}!",
        claims.sub
    ))
}

use backend::product_crud::ProductCreationError;

#[derive(serde::Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

// ... other async functions

async fn create_product(
    State(app_state): State<Arc<AppState>>,
    Json(new_product): Json<models::NewProduct>,
) -> impl IntoResponse {
    let mut conn = match app_state.pool.get() {
        Ok(conn) => conn,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "Could not connect to database".to_string(),
                }),
            ).into_response();
        }
    };

    match product_crud::create_product(&mut conn, &new_product) {
        Ok(product) => (StatusCode::CREATED, Json(product)).into_response(),
        Err(ProductCreationError::ValidationErrors(validation_errors)) => {
            #[derive(serde::Serialize)]
            struct ValidationErrorResponse {
                message: String,
                errors: Vec<product_crud::ProductValidationError>,
            }
            (
                StatusCode::BAD_REQUEST,
                Json(ValidationErrorResponse {
                    message: "Validation failed".to_string(),
                    errors: validation_errors,
                }),
            )
                .into_response()
        }
        Err(ProductCreationError::DuplicateProductId) => (
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                message: "Product with this ID already exists.".to_string(),
            }),
        )
            .into_response(),
        Err(ProductCreationError::DatabaseError(msg)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                message: format!("Database error: {}", msg),
            }),
        )
            .into_response(),
        Err(ProductCreationError::UnknownError) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                message: "An unknown error occurred during product creation.".to_string(),
            }),
        )
            .into_response(),
    }
}

async fn update_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(mut product): Json<models::Product>,
) -> impl IntoResponse {
    let mut conn = match app_state.pool.get() {
        Ok(conn) => conn,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "Could not connect to database".to_string(),
                }),
            ).into_response();
        }
    };

    product.product_id = product_id;

    match product_crud::update_product(&mut conn, &product) {
        Ok(updated_product) => (StatusCode::OK, Json(updated_product)).into_response(),
        Err(product_crud::ProductUpdateError::ValidationErrors(validation_errors)) => {
             #[derive(serde::Serialize)]
            struct ValidationErrorResponse {
                message: String,
                errors: Vec<product_crud::ProductValidationError>,
            }
            (
                StatusCode::BAD_REQUEST,
                Json(ValidationErrorResponse {
                    message: "Validation failed".to_string(),
                    errors: validation_errors,
                }),
            )
                .into_response()
        }
        Err(product_crud::ProductUpdateError::NotFound) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                message: "Product not found".to_string(),
            }),
        )
            .into_response(),
        Err(product_crud::ProductUpdateError::DatabaseError(msg)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                message: format!("Database error: {}", msg),
            }),
        )
            .into_response(),
        Err(product_crud::ProductUpdateError::UnknownError) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                message: "An unknown error occurred during product update.".to_string(),
            }),
        )
            .into_response(),
    }
}

async fn delete_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut conn = app_state
        .pool
        .get()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    product_crud::delete_product(&mut conn, &product_id)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })
}