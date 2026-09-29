use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode, header},
    routing::post,
};

use crate::AppError;
use crate::AppState;
use crate::account;
use crate::analytics::{self, SiteEvent, Subject, Visitor};
use crate::auth;
use crate::blog_crud;
use crate::db;
use crate::language::Language;
use crate::product_crud;

/// Product ids and slugs are shorter than this; longer ones skip the lookup.
const MAX_SUBJECT_LEN: usize = 256;

/// Always 204 for a well-formed event, whether counted or not: opted-out
/// visitors, bots and unknown products or posts are dropped silently.
async fn record_event(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    language: Language,
    Json(event): Json<SiteEvent>,
) -> Result<StatusCode, AppError> {
    let network = auth::client_network(auth::extract_client_ip(&headers));
    app_state
        .events_limiter
        .check_key(&network)
        .map_err(|_| AppError::TooManyRequests)?;

    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    if analytics::opted_out(&headers) || analytics::is_bot(user_agent) {
        return Ok(StatusCode::NO_CONTENT);
    }

    let known = match event.subject() {
        Subject::None => true,
        Subject::Product(id) | Subject::BlogPost(id) if id.len() > MAX_SUBJECT_LEN => false,
        Subject::Product(id) => {
            product_crud::is_listed(&mut *db::get_db_connection(&app_state)?, id)?
        }
        Subject::BlogPost(slug) => {
            blog_crud::is_published(&mut *db::get_db_connection(&app_state)?, slug)?
        }
    };
    if known {
        event.record(
            language,
            Visitor {
                network,
                user_agent,
            },
        );
    }
    Ok(StatusCode::NO_CONTENT)
}

pub fn router(app_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/events", post(record_event))
        .layer(DefaultBodyLimit::max(1024))
        .route_layer(axum::middleware::from_fn_with_state(
            app_state,
            account::same_origin_only,
        ))
}
