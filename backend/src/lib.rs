pub mod auth;
pub mod blog_crud;
pub mod db;
pub mod enum_crud;
pub mod enums;
pub mod error;
pub mod image_crud;
pub mod models;
pub mod product_crud;
pub mod schema;
pub mod user_crud;
pub mod utils;

pub use crate::db::get_db_connection;
pub use crate::error::{AppError, ErrorResponse, ValidationErrorResponse};

pub struct AppState {
    pub pool: db::PgPool,
}

// Export modules and their contents
pub use crate::auth::{Claims, LoginPayload, LoginResponse};
pub use crate::models::{AdminUser, NewAdminUser, NewProduct, NewUser, Product, User};
pub use crate::blog_crud::{
    create_blog_post, delete_blog_post, get_all_blog_posts, get_all_blog_posts_admin,
    get_blog_post_by_blog_id, get_blog_post_by_id, update_blog_post,
};
pub use crate::product_crud::{
    create_product, delete_product, get_all_products, get_product, update_product,
};
pub use crate::schema::*;
pub use crate::user_crud::{
    create_admin, create_regular, delete_admin, delete_regular, get_admin, get_regular,
    update_admin_password, update_regular_password,
};
pub use crate::utils::{salt_and_hash, verify_password};
