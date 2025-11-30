use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;

use crate::product_crud::{ProductCreationError, ProductUpdateError, ProductValidationError};

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ValidationErrorResponse {
    pub message: String,
    pub errors: Vec<ProductValidationError>,
}

#[derive(Debug)]
pub enum AppError {
    ProductCreation(ProductCreationError),
    ProductUpdate(ProductUpdateError),
    DatabaseConnectionError,
    InternalServerError(String),
    NotFound(String),
    BadRequest(String),
    Unauthorized(String), // Added for authentication/authorization failures
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AppError::ProductCreation(err) => match err {
                ProductCreationError::ValidationErrors(validation_errors) => (
                    StatusCode::BAD_REQUEST,
                    Json(ValidationErrorResponse {
                        message: "Validation failed".to_string(),
                        errors: validation_errors,
                    }),
                )
                    .into_response(),
                ProductCreationError::DuplicateProductId => (
                    StatusCode::CONFLICT,
                    Json(ErrorResponse {
                        message: "Product with this ID already exists.".to_string(),
                    }),
                )
                    .into_response(),
                ProductCreationError::DatabaseError(msg) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: format!("Database error: {}", msg),
                    }),
                )
                    .into_response(),
                ProductCreationError::UnknownError => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: "An unknown error occurred during product creation.".to_string(),
                    }),
                )
                    .into_response(),
            },
            AppError::ProductUpdate(err) => match err {
                ProductUpdateError::ValidationErrors(validation_errors) => (
                    StatusCode::BAD_REQUEST,
                    Json(ValidationErrorResponse {
                        message: "Validation failed".to_string(),
                        errors: validation_errors,
                    }),
                )
                    .into_response(),
                ProductUpdateError::NotFound => (
                    StatusCode::NOT_FOUND,
                    Json(ErrorResponse {
                        message: "Product not found".to_string(),
                    }),
                )
                    .into_response(),
                ProductUpdateError::DatabaseError(msg) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: format!("Database error: {}", msg),
                    }),
                )
                    .into_response(),
                ProductUpdateError::UnknownError => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: "An unknown error occurred during product update.".to_string(),
                    }),
                )
                    .into_response(),
            },
            AppError::DatabaseConnectionError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "Could not connect to database".to_string(),
                }),
            )
                .into_response(),
            AppError::InternalServerError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { message: msg }),
            )
                .into_response(),
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse { message: msg }),
            )
                .into_response(),
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse { message: msg }),
            )
                .into_response(),
            AppError::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse { message: msg }),
            )
                .into_response(),
        }
    }
}

impl From<ProductCreationError> for AppError {
    fn from(error: ProductCreationError) -> Self {
        AppError::ProductCreation(error)
    }
}

impl From<ProductUpdateError> for AppError {
    fn from(error: ProductUpdateError) -> Self {
        AppError::ProductUpdate(error)
    }
}

// Implement From for diesel::result::Error so that query results can be easily converted
impl From<diesel::result::Error> for AppError {
    fn from(error: diesel::result::Error) -> Self {
        match error {
            diesel::result::Error::NotFound => AppError::NotFound("Resource not found".to_string()),
            _ => AppError::InternalServerError(format!("Database error: {}", error)),
        }
    }
}

impl From<StatusCode> for AppError {
    fn from(status: StatusCode) -> Self {
        if status == StatusCode::INTERNAL_SERVER_ERROR {
            AppError::InternalServerError("An internal server error occurred".to_string())
        } else {
            AppError::BadRequest(format!("Request failed with status: {}", status))
        }
    }
}
