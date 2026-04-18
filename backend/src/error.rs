use axum::Json;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Serialize;

use crate::blog_crud::{BlogCreationError, BlogUpdateError};
use crate::product_crud::{ProductCreationError, ProductUpdateError};

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Debug, Serialize)]
struct ValidationErrorResponse<E: Serialize> {
    message: String,
    errors: Vec<E>,
}

#[derive(Debug)]
pub enum AppError {
    BlogCreation(BlogCreationError),
    BlogUpdate(BlogUpdateError),
    ProductCreation(ProductCreationError),
    ProductUpdate(ProductUpdateError),
    DatabaseConnectionError,
    InternalServerError(String),
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
    TooManyRequests,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AppError::BlogCreation(err) => match err {
                BlogCreationError::ValidationErrors(validation_errors) => (
                    StatusCode::BAD_REQUEST,
                    Json(ValidationErrorResponse {
                        message: "Validation failed".to_string(),
                        errors: validation_errors,
                    }),
                )
                    .into_response(),
                BlogCreationError::DuplicateSlug => (
                    StatusCode::CONFLICT,
                    Json(ErrorResponse {
                        message: "Blog post with this slug already exists.".to_string(),
                    }),
                )
                    .into_response(),
                BlogCreationError::DatabaseError(msg) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: format!("Database error: {}", msg),
                    }),
                )
                    .into_response(),
                BlogCreationError::UnknownError => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: "An unknown error occurred during blog post creation.".to_string(),
                    }),
                )
                    .into_response(),
            },
            AppError::BlogUpdate(err) => match err {
                BlogUpdateError::ValidationErrors(validation_errors) => (
                    StatusCode::BAD_REQUEST,
                    Json(ValidationErrorResponse {
                        message: "Validation failed".to_string(),
                        errors: validation_errors,
                    }),
                )
                    .into_response(),
                BlogUpdateError::NotFound => (
                    StatusCode::NOT_FOUND,
                    Json(ErrorResponse {
                        message: "Blog post not found".to_string(),
                    }),
                )
                    .into_response(),
                BlogUpdateError::DatabaseError(msg) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: format!("Database error: {}", msg),
                    }),
                )
                    .into_response(),
                BlogUpdateError::UnknownError => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        message: "An unknown error occurred during blog post update.".to_string(),
                    }),
                )
                    .into_response(),
            },
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
            AppError::NotFound(msg) => {
                (StatusCode::NOT_FOUND, Json(ErrorResponse { message: msg })).into_response()
            }
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
            AppError::TooManyRequests => (
                StatusCode::TOO_MANY_REQUESTS,
                Json(ErrorResponse {
                    message: "Too many login attempts. Try again later.".to_string(),
                }),
            )
                .into_response(),
        }
    }
}

impl From<BlogCreationError> for AppError {
    fn from(error: BlogCreationError) -> Self {
        AppError::BlogCreation(error)
    }
}

impl From<BlogUpdateError> for AppError {
    fn from(error: BlogUpdateError) -> Self {
        AppError::BlogUpdate(error)
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

impl From<diesel::result::Error> for AppError {
    fn from(error: diesel::result::Error) -> Self {
        use diesel::result::{DatabaseErrorKind, Error as DieselError};
        match error {
            DieselError::NotFound => AppError::NotFound("Resource not found".to_string()),
            DieselError::DatabaseError(kind, info) => match kind {
                DatabaseErrorKind::UniqueViolation => AppError::BadRequest(format!(
                    "Duplicate value violates unique constraint: {}",
                    info.constraint_name().unwrap_or("unknown")
                )),
                DatabaseErrorKind::ForeignKeyViolation => AppError::BadRequest(format!(
                    "Foreign key constraint violated: {}",
                    info.constraint_name().unwrap_or("unknown")
                )),
                DatabaseErrorKind::NotNullViolation => AppError::BadRequest(format!(
                    "Required field missing: {}",
                    info.column_name().unwrap_or("unknown")
                )),
                DatabaseErrorKind::CheckViolation => AppError::BadRequest(format!(
                    "Value failed check constraint: {}",
                    info.constraint_name().unwrap_or("unknown")
                )),
                _ => AppError::InternalServerError(format!("Database error: {}", info.message())),
            },
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
