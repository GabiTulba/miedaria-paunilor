pub mod auth;
pub mod blog_crud;
pub mod db;
pub mod enum_crud;
pub mod enums;
pub mod error;
pub mod image_crud;
pub mod language;
pub mod localized;
pub mod lot_crud;
pub mod models;
pub mod order_crud;
pub mod pagination;
pub mod product_crud;
pub mod routes;
pub mod rss_crud;
pub mod schema;
pub mod settings_crud;
pub mod sitemap_crud;
pub mod user_crud;
pub mod utils;

// Re-exported at the crate root because submodules import `crate::AppError`
// throughout. `ErrorResponse` is part of the public response shape.
pub use crate::error::{AppError, ErrorResponse};

use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DefaultKeyedStateStore};
use std::net::IpAddr;
use std::num::NonZeroU32;
use std::sync::Arc;

pub type IpRateLimiter = RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>;

pub fn build_login_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_minute(
        NonZeroU32::new(10).unwrap(),
    )))
}

pub fn build_image_serve_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_second(
        NonZeroU32::new(30).unwrap(),
    )))
}

pub fn build_admin_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_minute(
        NonZeroU32::new(60).unwrap(),
    )))
}

pub fn build_public_api_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_second(
        NonZeroU32::new(30).unwrap(),
    )))
}

pub struct AppState {
    pub pool: db::PgPool,
    pub login_limiter: Arc<IpRateLimiter>,
    pub image_serve_limiter: Arc<IpRateLimiter>,
    pub admin_limiter: Arc<IpRateLimiter>,
    pub public_api_limiter: Arc<IpRateLimiter>,
    pub site_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub image_upload_dir: String,
    pub stripe_client: stripe::Client,
    pub stripe_webhook_secret: String,
}

// Crate-root re-exports — only the symbols genuinely shared across
// submodules (`crate::AppError`) or required by the `add_admin_user` bin.
// Everything else is namespaced (`backend::<module>::Symbol`).
pub use crate::user_crud::{create_admin, get_admin};
pub use crate::utils::verify_password;
