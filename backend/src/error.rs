use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

use crate::blog_crud::BlogValidationError;
use crate::product_crud::ProductValidationError;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ValidationErrorResponse<E: Serialize> {
    pub message: String,
    pub errors: Vec<E>,
}

/// Internal repository-layer error returned by CRUD functions. Translated to
/// `AppError` at the handler boundary via `From`. Diesel errors are wrapped
/// (not stringified) so the `IntoResponse` layer logs them once with full
/// context while the client only sees a generic 500.
#[derive(Debug)]
pub enum RepositoryError {
    /// 404 with the given message
    NotFound(String),
    /// 409 with the given message (duplicate slug, already-deleted, too-recent, …)
    Conflict(String),
    /// 400 with the given message (not-deleted, not-soft-deleted, …)
    BadRequest(String),
    /// 400 with `{message: "Validation failed", errors: [...]}` envelope
    ProductValidation(Vec<ProductValidationError>),
    BlogValidation(Vec<BlogValidationError>),
    /// Wraps a Diesel error; surfaces as a generic 500 with server-side log.
    Database(diesel::result::Error),
}

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Conflict(String),
    BadRequest(String),
    Unauthorized(String),
    InternalServerError(String),
    ServiceUnavailable(String),
    DatabaseConnectionError,
    TooManyRequests,
    ProductValidation(Vec<ProductValidationError>),
    BlogValidation(Vec<BlogValidationError>),
    Database(diesel::result::Error),
}

fn json_error(status: StatusCode, message: impl Into<String>) -> Response {
    (
        status,
        Json(ErrorResponse {
            message: message.into(),
        }),
    )
        .into_response()
}

fn json_validation_error<E: Serialize>(errors: Vec<E>) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(ValidationErrorResponse {
            message: "Validation failed".to_string(),
            errors,
        }),
    )
        .into_response()
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::NotFound(m) => json_error(StatusCode::NOT_FOUND, m),
            AppError::Conflict(m) => json_error(StatusCode::CONFLICT, m),
            AppError::BadRequest(m) => json_error(StatusCode::BAD_REQUEST, m),
            AppError::Unauthorized(m) => json_error(StatusCode::UNAUTHORIZED, m),
            AppError::InternalServerError(m) => json_error(StatusCode::INTERNAL_SERVER_ERROR, m),
            AppError::ServiceUnavailable(m) => json_error(StatusCode::SERVICE_UNAVAILABLE, m),
            AppError::DatabaseConnectionError => json_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not connect to database",
            ),
            AppError::TooManyRequests => json_error(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many requests. Try again later.",
            ),
            AppError::ProductValidation(errors) => json_validation_error(errors),
            AppError::BlogValidation(errors) => json_validation_error(errors),
            AppError::Database(e) => {
                tracing::error!(error = %e, "db error");
                json_error(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
        }
    }
}

impl From<RepositoryError> for AppError {
    fn from(e: RepositoryError) -> Self {
        match e {
            RepositoryError::NotFound(m) => AppError::NotFound(m),
            RepositoryError::Conflict(m) => AppError::Conflict(m),
            RepositoryError::BadRequest(m) => AppError::BadRequest(m),
            RepositoryError::ProductValidation(v) => AppError::ProductValidation(v),
            RepositoryError::BlogValidation(v) => AppError::BlogValidation(v),
            RepositoryError::Database(e) => AppError::Database(e),
        }
    }
}

impl From<diesel::result::Error> for RepositoryError {
    fn from(e: diesel::result::Error) -> Self {
        // Default mapping: any unmapped Diesel error becomes a generic Database
        // failure. Call sites that need finer mapping (DuplicateSlug,
        // DuplicateProductId, …) inspect the error themselves before letting
        // it reach this conversion.
        match e {
            diesel::result::Error::NotFound => {
                RepositoryError::NotFound("Resource not found".to_string())
            }
            other => RepositoryError::Database(other),
        }
    }
}

impl From<diesel::result::Error> for AppError {
    fn from(e: diesel::result::Error) -> Self {
        AppError::from(RepositoryError::from(e))
    }
}
