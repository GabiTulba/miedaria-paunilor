use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};

use crate::AppError;
use crate::AppState;
use crate::auth;
use crate::db;
use crate::enum_crud;
use crate::exchange_rate::ExchangeRateInfo;
use crate::rss_crud;
use crate::sitemap_crud;

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn get_enum_values() -> Result<Json<enum_crud::EnumValues>, AppError> {
    Ok(Json(enum_crud::get_all_enum_values()))
}

/// Returns the BNR EUR rate used for indicative price conversion, or `null`
/// when no rate has been fetched yet. Served from the in-memory cache — no
/// database access.
async fn get_exchange_rate(
    State(app_state): State<Arc<AppState>>,
) -> Json<Option<ExchangeRateInfo>> {
    Json(app_state.current_eur_rate().map(ExchangeRateInfo::from))
}

async fn get_sitemap_data(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<sitemap_crud::SitemapData>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let sitemap_data = sitemap_crud::get_sitemap_data(&mut conn, &app_state.site_url)?;
    Ok(Json(sitemap_data))
}

async fn get_blog_rss(
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let body = rss_crud::generate_rss_xml(&mut conn, &app_state.site_url)?;
    Ok((
        StatusCode::OK,
        [
            (
                axum::http::header::CONTENT_TYPE,
                "application/rss+xml; charset=utf-8",
            ),
            (axum::http::header::CACHE_CONTROL, "public, max-age=600"),
        ],
        body,
    ))
}

async fn me_route(
    Extension(claims): Extension<auth::Claims>,
) -> Result<Json<auth::MeResponse>, StatusCode> {
    Ok(Json(auth::MeResponse {
        username: claims.sub,
        exp: claims.exp as i64,
    }))
}

/// Top-level unscoped routes (no auth, no rate limit).
pub fn unscoped_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(health_check))
        .route("/api/enums", get(get_enum_values))
        .route("/api/exchange-rate", get(get_exchange_rate))
        .route("/api/sitemap-data", get(get_sitemap_data))
        .route("/blog/rss.xml", get(get_blog_rss))
}

/// Admin session-probe route. Returns the signed-in admin's username + the
/// JWT expiry timestamp so the FE can schedule a client-side auto-logout
/// without ever reading the httpOnly cookie.
pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new().route("/me", get(me_route))
}
