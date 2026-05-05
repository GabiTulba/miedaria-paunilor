use crate::AppState;
use axum::http::StatusCode;
use diesel::Connection;
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use dotenvy::dotenv;
use std::env;
use std::sync::Arc;
use std::time::Duration;

pub type PgPool = Pool<ConnectionManager<PgConnection>>;

const POOL_MAX_SIZE: u32 = 20;
const POOL_CONNECTION_TIMEOUT: Duration = Duration::from_secs(5);

pub fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgConnection::establish(&database_url)
        .unwrap_or_else(|err| panic!("Error connecting to {}: {}", database_url, err))
}

pub fn establish_pooled_connection(database_url: &str) -> Result<PgPool, r2d2::Error> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .max_size(POOL_MAX_SIZE)
        .connection_timeout(POOL_CONNECTION_TIMEOUT)
        .build(manager)
}

pub fn get_db_connection(
    app_state: &Arc<AppState>,
) -> Result<PooledConnection<ConnectionManager<PgConnection>>, StatusCode> {
    app_state
        .pool
        .get()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
