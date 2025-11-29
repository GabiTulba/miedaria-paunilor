use axum::{
    extract::{FromRequest, Request, State},
    http::StatusCode,
    Json,
};
use jsonwebtoken::{encode, DecodingKey, EncodingKey, Header, Validation, decode};
use serde::{Deserialize, Serialize};
use std::env;
use crate::user_crud;
use crate::utils::verify_password;
use std::sync::Arc;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
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

pub async fn login(
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<LoginResponse>, StatusCode> {
    println!("DEBUG: Login function entered for user: {}", payload.username); // DEBUG LINE

    let mut conn = app_state
        .pool
        .get()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = user_crud::get_admin(&mut conn, &payload.username)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !verify_password(&payload.password, &user.salt, &user.hashed_password) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let now = chrono::Utc::now();
    let exp = (now + chrono::Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user.username.clone(),
        exp,
    };

    let secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref()))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse { token }))
}

impl FromRequest<Arc<AppState>> for Claims
{
    type Rejection = StatusCode;

    async fn from_request(req: Request, _state: &Arc<AppState>) -> Result<Self, Self::Rejection> {
        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|header| header.to_str().ok());

        if let Some(auth_header) = auth_header {
            if auth_header.starts_with("Bearer ") {
                let token = &auth_header[7..];
                let secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
                let token_data = decode::<Claims>(
                    token,
                    &DecodingKey::from_secret(secret.as_ref()),
                    &Validation::default(),
                )
                .map_err(|_| StatusCode::UNAUTHORIZED)?;
                return Ok(token_data.claims);
            }
        }

        Err(StatusCode::UNAUTHORIZED)
    }
}
