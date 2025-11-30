pub mod models;
pub mod schema;
pub mod utils;
pub mod user_crud;
pub mod product_crud;
pub mod auth;
pub mod image_crud; // New module

use diesel::prelude::*;
use dotenvy::dotenv;
use std::env;
use diesel::r2d2::{ConnectionManager};

pub type Pool = r2d2::Pool<ConnectionManager<PgConnection>>;
pub struct AppState {
    pub pool: Pool,
}

pub fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
     PgConnection::establish(&database_url)
        .unwrap_or_else(|_| panic!("Error connecting to {}", database_url))
}

// Export modules and their contents
pub use crate::models::{Product, NewProduct, AdminUser, NewAdminUser, User, NewUser};
pub use crate::schema::*;
pub use crate::user_crud::{create_admin, get_admin, update_admin_password, delete_admin, create_regular, get_regular, update_regular_password, delete_regular};
pub use crate::product_crud::{create_product, get_product, update_product, delete_product, get_all_products};
pub use crate::utils::{salt_and_hash, verify_password};
pub use crate::auth::{Claims, LoginPayload, LoginResponse};