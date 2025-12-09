pub mod models;
pub mod schema;
pub mod utils;
pub mod user_crud;
pub mod product_crud;
pub mod auth;
pub mod image_crud;
pub mod enums;
pub mod db; 
pub mod error; 

pub use crate::db::get_db_connection;
pub use crate::error::{AppError, ErrorResponse, ValidationErrorResponse};


pub struct AppState {
    pub pool: db::PgPool,
}

// Export modules and their contents
pub use crate::models::{Product, NewProduct, AdminUser, NewAdminUser, User, NewUser};
pub use crate::schema::*;
pub use crate::user_crud::{create_admin, get_admin, update_admin_password, delete_admin, create_regular, get_regular, update_regular_password, delete_regular};
pub use crate::product_crud::{create_product, get_product, update_product, delete_product, get_all_products};
pub use crate::utils::{salt_and_hash, verify_password};
pub use crate::auth::{Claims, LoginPayload, LoginResponse};