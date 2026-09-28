use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use serde::Deserialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::AppError;
use crate::AppState;
use crate::auth;
use crate::db;
use crate::language::Language;
use crate::newsletter::{self, NewsletterStats};

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct SubscribeRequest {
    pub email: String,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct ConfirmSubscriptionRequest {
    pub token: String,
}

#[derive(Deserialize)]
struct UnsubscribeQuery {
    id: Uuid,
    token: String,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct NotifySubscribersRequest {
    /// Email the post again even though it was already announced.
    #[serde(default)]
    pub resend: bool,
}

#[derive(serde::Serialize, TS)]
#[ts(export)]
pub struct NotifySubscribersResponse {
    pub recipients: u32,
}

/// Always answers 204 for a valid address, whether it is new, pending or
/// already subscribed, so the endpoint cannot be used to probe the list.
async fn subscribe(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    lang: Language,
    Json(request): Json<SubscribeRequest>,
) -> Result<StatusCode, AppError> {
    app_state
        .newsletter_limiter
        .check_key(&auth::client_network(auth::extract_client_ip(&headers)))
        .map_err(|_| AppError::TooManyRequests)?;

    let email = newsletter::normalize_email(&request.email)
        .ok_or_else(|| AppError::BadRequest("Invalid email address".to_string()))?;
    let mut conn = db::get_db_connection(&app_state)?;
    if let Some(token) = newsletter::subscribe(&mut conn, &email, lang)? {
        app_state
            .mailer
            .send_in_background(newsletter::confirmation_email(
                &app_state.site_url,
                lang,
                email,
                &token,
            ));
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn confirm(
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<ConfirmSubscriptionRequest>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    if newsletter::confirm(&mut conn, &request.token)? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound(
            "Confirmation link is invalid or expired".to_string(),
        ))
    }
}

/// Target of both the unsubscribe page and RFC 8058 one-click requests from
/// mail clients (which POST a form body this handler does not need).
async fn unsubscribe(
    State(app_state): State<Arc<AppState>>,
    Query(query): Query<UnsubscribeQuery>,
) -> Result<StatusCode, AppError> {
    if !newsletter::verify_unsubscribe_token(&app_state.unsubscribe_key, query.id, &query.token) {
        return Err(AppError::BadRequest("Invalid unsubscribe link".to_string()));
    }
    let mut conn = db::get_db_connection(&app_state)?;
    newsletter::unsubscribe(&mut conn, query.id)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_stats(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<NewsletterStats>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    Ok(Json(newsletter::stats(&mut conn)?))
}

async fn notify_subscribers(
    State(app_state): State<Arc<AppState>>,
    Path(post_id): Path<Uuid>,
    Json(request): Json<NotifySubscribersRequest>,
) -> Result<Json<NotifySubscribersResponse>, AppError> {
    let (post, subscribers) = {
        let mut conn = db::get_db_connection(&app_state)?;
        let post = newsletter::claim_announcement(&mut conn, post_id, request.resend)?;
        (post, newsletter::confirmed_subscribers(&mut conn)?)
    };

    let emails: Vec<_> = subscribers
        .iter()
        .filter_map(|subscriber| {
            let to = subscriber.email.parse().ok()?;
            Some(newsletter::blog_post_email(
                &app_state.site_url,
                &app_state.unsubscribe_key,
                subscriber,
                to,
                &post,
            ))
        })
        .collect();
    let recipients = emails.len() as u32;
    app_state.mailer.send_batch_in_background(emails);
    Ok(Json(NotifySubscribersResponse { recipients }))
}

/// Routes mounted at `/api/...` (public, rate-limited via `public_api_rate_limit`).
pub fn public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/newsletter/subscribe", post(subscribe))
        .route("/api/newsletter/confirm", post(confirm))
        .route("/api/newsletter/unsubscribe", post(unsubscribe))
}

/// Routes mounted under `/api/admin/...`.
pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/newsletter/stats", get(get_stats))
        .route("/blog/{id}/notify", post(notify_subscribers))
}
