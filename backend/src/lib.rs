pub mod auth;
pub mod blog_crud;
pub mod db;
pub mod enum_crud;
pub mod enums;
pub mod error;
pub mod image_crud;
pub mod language;
pub mod localized;
pub mod models;
pub mod product_crud;
pub mod rss_crud;
pub mod schema;
pub mod sitemap_crud;
pub mod user_crud;
pub mod utils;

pub use crate::db::get_db_connection;
pub use crate::error::{AppError, ErrorResponse};

use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DefaultKeyedStateStore};
use std::net::IpAddr;
use std::num::NonZeroU32;
use std::sync::Arc;

pub type IpRateLimiter = RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>;

pub fn build_login_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(
        Quota::per_minute(NonZeroU32::new(10).unwrap()),
    ))
}

pub fn build_image_serve_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(
        Quota::per_second(NonZeroU32::new(30).unwrap()),
    ))
}

pub fn build_admin_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(
        Quota::per_minute(NonZeroU32::new(60).unwrap()),
    ))
}

pub fn build_public_api_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(
        Quota::per_second(NonZeroU32::new(30).unwrap()),
    ))
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
}

// Export modules and their contents
pub use crate::auth::{Claims, LoginPayload, LoginResponse};
pub use crate::blog_crud::{
    count_all_blog_posts, count_all_blog_posts_admin, create_blog_post, delete_blog_post,
    get_all_blog_posts, get_all_blog_posts_admin, get_blog_post_by_slug, get_blog_post_by_id,
    update_blog_post,
};
pub use crate::models::{AdminUser, NewAdminUser, NewProduct, PaginatedResponse, Product};
pub use crate::product_crud::{
    count_all_products, count_all_products_admin, create_product, delete_product, get_all_products,
    get_all_products_admin, get_product, get_product_admin, hard_delete_product, restore_product,
    update_product, IncludeDeleted,
};
pub use crate::schema::*;
pub use crate::user_crud::{create_admin, delete_admin, get_admin, update_admin_password};
pub use crate::utils::{hash_password, verify_password};
