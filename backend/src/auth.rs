use crate::AppError;
use crate::AppState;
use crate::db;
use crate::user_crud;
use crate::utils::{hash_password, verify_password};
use axum::{
    Json,
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::{Arc, OnceLock};

/// Name of the httpOnly auth cookie. Scoped to /api/admin so it never leaks
/// to public endpoints.
pub const AUTH_COOKIE: &str = "admin_session";
const AUTH_COOKIE_PATH: &str = "/api/admin";

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

#[derive(Debug, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, rename = "LoginCredentials")]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct LoginResponse {
    pub username: String,
    #[ts(type = "number")]
    pub exp: i64,
}

#[derive(Debug, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct MeResponse {
    pub username: String,
    #[ts(type = "number")]
    pub exp: i64,
}

fn build_auth_cookie(token: String, max_age_hours: i64) -> Cookie<'static> {
    Cookie::build((AUTH_COOKIE, token))
        .path(AUTH_COOKIE_PATH)
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::hours(max_age_hours))
        .build()
}

fn clear_auth_cookie() -> Cookie<'static> {
    // An empty value with Max-Age=0 tells the UA to drop the cookie. Path
    // must match the one used at set-time for the removal to take effect.
    Cookie::build((AUTH_COOKIE, ""))
        .path(AUTH_COOKIE_PATH)
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::ZERO)
        .build()
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
    jar: CookieJar,
    headers: HeaderMap,
    Json(payload): Json<LoginPayload>,
) -> Result<(CookieJar, Json<LoginResponse>), AppError> {
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
    let exp_dt = now + chrono::Duration::hours(app_state.jwt_expiration_hours);
    let exp = exp_dt.timestamp();
    let claims = Claims {
        sub: user.username.clone(),
        exp: exp as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(app_state.jwt_secret.as_ref()),
    )
    .map_err(|_| AppError::InternalServerError("Failed to encode JWT".to_string()))?;

    let jar = jar.add(build_auth_cookie(token, app_state.jwt_expiration_hours));

    Ok((
        jar,
        Json(LoginResponse {
            username: user.username,
            exp,
        }),
    ))
}

pub async fn logout(jar: CookieJar) -> (CookieJar, StatusCode) {
    (jar.add(clear_auth_cookie()), StatusCode::NO_CONTENT)
}

pub async fn auth_middleware(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = jar
        .get(AUTH_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::Unauthorized("Auth cookie missing".to_string()))?;

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
