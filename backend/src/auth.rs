use crate::AppError;
use crate::AppState;
use crate::db;
use crate::user_crud;
use crate::utils::{hash_password, verify_password};
use axum::{
    Json,
    extract::{Request, State},
    http::HeaderMap,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::{Arc, OnceLock};

/// PHC-encoded Argon2 hash of an arbitrary string, computed lazily on first
/// failed-username login. Used to equalize response time between "user does
/// not exist" and "wrong password" paths so attackers can't enumerate admins
/// via timing.
fn dummy_password_hash() -> &'static str {
    static DUMMY: OnceLock<String> = OnceLock::new();
    DUMMY.get_or_init(|| {
        hash_password("not-a-real-password")
            .expect("Argon2 must be able to hash a dummy password")
    })
}

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

/// SECURITY: Trusts `X-Real-IP` / `X-Forwarded-For` from any caller.
/// This is only safe because the backend listens on the docker-compose
/// internal network, with nginx as the sole upstream that sets these
/// headers. If the listener is ever exposed directly, an attacker can
/// spoof the source IP and bypass the rate limiter — restrict to a
/// trusted CIDR or fall back to `req.peer_addr()` before doing so.
pub(crate) fn extract_client_ip(headers: &HeaderMap) -> IpAddr {
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

    let user_opt = user_crud::get_admin(&mut conn, &payload.username).map_err(|e| {
        tracing::error!("login admin lookup failed: {:?}", e);
        AppError::InternalServerError("Internal server error".to_string())
    })?;

    let valid = match &user_opt {
        Some(user) => verify_password(&payload.password, &user.hashed_password),
        None => {
            // Run a hash verification anyway to keep the response time
            // independent of whether the username exists.
            let _ = verify_password(&payload.password, dummy_password_hash());
            false
        }
    };

    if !valid {
        tracing::warn!(
            username = %payload.username,
            ip = %client_ip,
            "login failed: bad credentials"
        );
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    let user = user_opt.expect("valid implies user exists");

    let now = chrono::Utc::now();
    let exp = (now + chrono::Duration::hours(app_state.jwt_expiration_hours)).timestamp() as usize;
    let claims = Claims {
        sub: user.username.clone(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(app_state.jwt_secret.as_ref()),
    )
    .map_err(|_| AppError::InternalServerError("Failed to encode JWT".to_string()))?;

    Ok(Json(LoginResponse { token }))
}

pub async fn auth_middleware(
    State(app_state): State<Arc<AppState>>,
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

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(app_state.jwt_secret.as_ref()),
        &validation,
    )
    .map_err(|e| {
        tracing::error!("JWT decoding error: {:?}", e);
        AppError::Unauthorized("Invalid or expired token".to_string())
    })?;

    let mut conn = db::get_db_connection(&app_state)?;
    let admin = user_crud::get_admin(&mut conn, &token_data.claims.sub).map_err(|e| {
        tracing::error!("auth middleware admin lookup failed: {:?}", e);
        AppError::InternalServerError("Internal server error".to_string())
    })?;
    if admin.is_none() {
        tracing::warn!(
            sub = %token_data.claims.sub,
            "rejecting JWT with no matching admin row"
        );
        return Err(AppError::Unauthorized("Invalid or expired token".to_string()));
    }

    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}

pub async fn image_serve_rate_limit(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let client_ip = extract_client_ip(&headers);
    app_state
        .image_serve_limiter
        .check_key(&client_ip)
        .map_err(|_| AppError::TooManyRequests)?;
    Ok(next.run(req).await)
}

pub async fn admin_rate_limit(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let client_ip = extract_client_ip(&headers);
    app_state
        .admin_limiter
        .check_key(&client_ip)
        .map_err(|_| AppError::TooManyRequests)?;
    Ok(next.run(req).await)
}

pub async fn public_api_rate_limit(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let client_ip = extract_client_ip(&headers);
    app_state
        .public_api_limiter
        .check_key(&client_ip)
        .map_err(|_| AppError::TooManyRequests)?;
    Ok(next.run(req).await)
}
