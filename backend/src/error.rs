use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

use crate::blog_crud::{BlogCreationError, BlogUpdateError};
use crate::product_crud::{
    HardDeleteError, ProductCreationError, ProductUpdateError, RestoreError, SoftDeleteError,
};

/// Builds a generic 500 response for database failures. Logs the actual error
/// server-side so it stays diagnosable, but the client sees only a stable
/// message — avoids leaking schema details (constraint/table/column names) to
/// callers, which could otherwise accelerate reconnaissance.
fn db_error_response(context: &str, detail: impl std::fmt::Display) -> Response {
    tracing::error!(context = context, error = %detail, "db error");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            message: "Internal server error".to_string(),
        }),
    )
        .into_response()
}

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
    Conflict(String),
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
                BlogCreationError::DatabaseError(msg) => {
                    db_error_response("blog_creation", msg)
                }
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
                BlogUpdateError::DuplicateSlug => (
                    StatusCode::CONFLICT,
                    Json(ErrorResponse {
                        message: "Blog post with this slug already exists.".to_string(),
                    }),
                )
                    .into_response(),
                BlogUpdateError::DatabaseError(msg) => {
                    db_error_response("blog_update", msg)
                }
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
                ProductCreationError::DatabaseError(msg) => {
                    db_error_response("product_creation", msg)
                }
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
                ProductUpdateError::DatabaseError(msg) => {
                    db_error_response("product_update", msg)
                }
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
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
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
                    message: "Too many requests. Try again later.".to_string(),
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
                DatabaseErrorKind::UniqueViolation => {
                    tracing::warn!(
                        constraint = info.constraint_name().unwrap_or("unknown"),
                        "unique violation"
                    );
                    AppError::BadRequest("Duplicate value".to_string())
                }
                DatabaseErrorKind::ForeignKeyViolation => {
                    tracing::warn!(
                        constraint = info.constraint_name().unwrap_or("unknown"),
                        "foreign-key violation"
                    );
                    AppError::BadRequest("Foreign key constraint violated".to_string())
                }
                DatabaseErrorKind::NotNullViolation => {
                    tracing::warn!(
                        column = info.column_name().unwrap_or("unknown"),
                        "not-null violation"
                    );
                    AppError::BadRequest("Required field missing".to_string())
                }
                DatabaseErrorKind::CheckViolation => {
                    tracing::warn!(
                        constraint = info.constraint_name().unwrap_or("unknown"),
                        "check violation"
                    );
                    AppError::BadRequest("Value failed check constraint".to_string())
                }
                _ => {
                    tracing::error!(kind = ?kind, message = info.message(), "db error");
                    AppError::InternalServerError("Internal server error".to_string())
                }
            },
            other => {
                tracing::error!(error = %other, "db error");
                AppError::InternalServerError("Internal server error".to_string())
            }
        }
    }
}

impl From<SoftDeleteError> for AppError {
    fn from(err: SoftDeleteError) -> Self {
        match err {
            SoftDeleteError::NotFound => AppError::NotFound("Product not found".to_string()),
            SoftDeleteError::AlreadyDeleted => {
                AppError::Conflict("Product is already deleted".to_string())
            }
            SoftDeleteError::DatabaseError(msg) => {
                tracing::error!(error = %msg, "soft-delete db error");
                AppError::InternalServerError("Internal server error".to_string())
            }
        }
    }
}

impl From<RestoreError> for AppError {
    fn from(err: RestoreError) -> Self {
        match err {
            RestoreError::NotFound => AppError::NotFound("Product not found".to_string()),
            RestoreError::NotDeleted => {
                AppError::BadRequest("Product is not deleted".to_string())
            }
            RestoreError::DatabaseError(msg) => {
                tracing::error!(error = %msg, "restore db error");
                AppError::InternalServerError("Internal server error".to_string())
            }
        }
    }
}

impl From<HardDeleteError> for AppError {
    fn from(err: HardDeleteError) -> Self {
        match err {
            HardDeleteError::NotFound => AppError::NotFound("Product not found".to_string()),
            HardDeleteError::NotSoftDeleted => {
                AppError::BadRequest("Product has not been soft-deleted".to_string())
            }
            HardDeleteError::TooRecent(eligible_at) => AppError::Conflict(format!(
                "Product cannot be permanently deleted until {}",
                eligible_at.format("%Y-%m-%dT%H:%M:%SZ")
            )),
            HardDeleteError::DatabaseError(msg) => {
                tracing::error!(error = %msg, "hard-delete db error");
                AppError::InternalServerError("Internal server error".to_string())
            }
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
