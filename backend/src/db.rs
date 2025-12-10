use crate::AppState;
use axum::http::StatusCode;
use diesel::Connection;
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use dotenvy::dotenv;
use std::env;
use std::sync::Arc;

pub type PgPool = Pool<ConnectionManager<PgConnection>>;

pub fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgConnection::establish(&database_url)
        .unwrap_or_else(|err| panic!("Error connecting to {}: {}", database_url, err))
}

pub fn establish_pooled_connection() -> PgPool {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.")
}

pub fn get_db_connection(
    app_state: &Arc<AppState>,
) -> Result<PooledConnection<ConnectionManager<PgConnection>>, StatusCode> {
    app_state
        .pool
        .get()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
