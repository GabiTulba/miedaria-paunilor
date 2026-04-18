use crate::AppError;
use crate::AppState;
use crate::db;
use crate::user_crud;
use crate::utils::verify_password;
use axum::{
    Json,
    extract::{Request, State},
    http::HeaderMap,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use std::env;
use std::net::IpAddr;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginPayload {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    token: String,
}

fn extract_client_ip(headers: &HeaderMap) -> IpAddr {
    headers
        .get("X-Real-IP")
        .or_else(|| headers.get("X-Forwarded-For"))
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .and_then(|s| s.trim().parse::<IpAddr>().ok())
        .unwrap_or(IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED))
}

pub async fn login(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<LoginResponse>, AppError> {
    let client_ip = extract_client_ip(&headers);
    app_state
        .login_limiter
        .check_key(&client_ip)
        .map_err(|_| AppError::TooManyRequests)?;

    let mut conn = db::get_db_connection(&app_state)?;

    let user = user_crud::get_admin(&mut conn, &payload.username)
        .map_err(|e| AppError::InternalServerError(format!("Database error: {}", e)))?
        .ok_or(AppError::Unauthorized("Invalid credentials".to_string()))?;

    if !verify_password(&payload.password, &user.hashed_password) {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    let now = chrono::Utc::now();
    let jwt_expiration_hours = env::var("JWT_EXPIRATION_HOURS")
        .map_err(|_| AppError::InternalServerError("JWT_EXPIRATION_HOURS not set".to_string()))?
        .parse::<i64>()
        .map_err(|_| AppError::InternalServerError("JWT_EXPIRATION_HOURS must be a valid integer".to_string()))?;
    let exp = (now + chrono::Duration::hours(jwt_expiration_hours)).timestamp() as usize;
    let claims = Claims {
        sub: user.username.clone(),
        exp,
    };

    let secret = env::var("JWT_SECRET")
        .map_err(|_| AppError::InternalServerError("JWT_SECRET not set".to_string()))?;
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|_| AppError::InternalServerError("Failed to encode JWT".to_string()))?;

    Ok(Json(LoginResponse { token }))
}

pub async fn auth_middleware(
    State(_app_state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|header| header.to_str().ok());

    let token = if let Some(header_value) = auth_header {
        if header_value.starts_with("Bearer ") {
            header_value[7..].to_string()
        } else {
            return Err(AppError::Unauthorized(
                "Invalid authorization header format".to_string(),
            ));
        }
    } else {
        return Err(AppError::Unauthorized(
            "Authorization header missing".to_string(),
        ));
    };

    let secret = env::var("JWT_SECRET")
        .map_err(|_| AppError::InternalServerError("JWT_SECRET not set".to_string()))?;
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )
    .map_err(|e| {
        tracing::error!("JWT decoding error: {:?}", e);
        AppError::Unauthorized("Invalid or expired token".to_string())
    })?;

    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}
