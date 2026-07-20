use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use uuid::Uuid;

use crate::AppError;
use crate::AppState;
use crate::db;
use crate::enums::OrderStatus;
use crate::language::Language;
use crate::models::{
    CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatus, Order, OrderWithItems,
    PaginatedResponse,
};
use crate::order_crud;
use crate::pagination::{self, PageQuery};
use crate::settings_crud;

/// How long a Checkout Session (and its stock reservation) stays valid.
/// 30 minutes is Stripe's minimum for `expires_at`.
const SESSION_EXPIRY_SECS: i64 = 30 * 60;

async fn create_checkout_session(
    State(app_state): State<Arc<AppState>>,
    lang: Language,
    Json(request): Json<CheckoutSessionRequest>,
) -> Result<Json<CheckoutSessionResponse>, AppError> {
    let OrderWithItems { order, items } = {
        let mut conn = db::get_db_connection(&app_state)?;
        if !settings_crud::is_checkout_enabled(&mut conn)? {
            return Err(AppError::ServiceUnavailable(
                "Checkout is temporarily disabled".to_string(),
            ));
        }
        order_crud::create_pending_order(&mut conn, &request.items, lang)?
    };

    let (currency, lang_code) = match lang {
        Language::En => (stripe::Currency::EUR, "en"),
        Language::Ro => (stripe::Currency::RON, "ro"),
    };

    let line_items: Vec<stripe::CreateCheckoutSessionLineItems> = items
        .iter()
        .map(|item| stripe::CreateCheckoutSessionLineItems {
            price_data: Some(stripe::CreateCheckoutSessionLineItemsPriceData {
                currency,
                unit_amount: Some(item.unit_amount_cents),
                product_data: Some(stripe::CreateCheckoutSessionLineItemsPriceDataProductData {
                    name: item.product_name.clone(),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            quantity: Some(item.quantity as u64),
            ..Default::default()
        })
        .collect();

    let order_id_str = order.order_id.to_string();
    let success_url = format!(
        "{}/{}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
        app_state.site_url, lang_code
    );
    let cancel_url = format!("{}/{}/cart", app_state.site_url, lang_code);

    let mut params = stripe::CreateCheckoutSession::new();
    params.mode = Some(stripe::CheckoutSessionMode::Payment);
    params.line_items = Some(line_items);
    params.success_url = Some(&success_url);
    params.cancel_url = Some(&cancel_url);
    params.client_reference_id = Some(&order_id_str);
    params.expires_at = Some(chrono::Utc::now().timestamp() + SESSION_EXPIRY_SECS);
    params.metadata = Some(HashMap::from([(
        "order_id".to_string(),
        order_id_str.clone(),
    )]));

    let session = stripe::CheckoutSession::create(&app_state.stripe_client, params).await;

    let mut conn = db::get_db_connection(&app_state)?;
    let session = match session {
        Ok(session) => session,
        Err(e) => {
            // The order already reserved stock; give it back before failing.
            tracing::error!(error = %e, order_id = %order.order_id, "stripe session creation failed");
            order_crud::release_order(&mut conn, order.order_id, OrderStatus::Failed)?;
            return Err(AppError::InternalServerError(
                "Could not start checkout. Please try again.".to_string(),
            ));
        }
    };

    order_crud::attach_stripe_session(&mut conn, order.order_id, session.id.as_str())?;

    let Some(url) = session.url else {
        tracing::error!(order_id = %order.order_id, "stripe session has no redirect url");
        order_crud::release_order(&mut conn, order.order_id, OrderStatus::Failed)?;
        return Err(AppError::InternalServerError(
            "Could not start checkout. Please try again.".to_string(),
        ));
    };

    Ok(Json(CheckoutSessionResponse { url }))
}

/// Fallback for events whose session was never attached to the order (e.g. the
/// attach write failed): recover the order id from the session metadata.
fn order_id_from_metadata(session: &stripe::CheckoutSession) -> Option<Uuid> {
    session
        .metadata
        .as_ref()
        .and_then(|m| m.get("order_id"))
        .and_then(|s| Uuid::parse_str(s).ok())
}

async fn stripe_webhook(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, AppError> {
    let signature = headers
        .get("Stripe-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("Missing Stripe-Signature header".to_string()))?;

    let payload = std::str::from_utf8(&body)
        .map_err(|_| AppError::BadRequest("Invalid webhook payload".to_string()))?;

    let event =
        stripe::Webhook::construct_event(payload, signature, &app_state.stripe_webhook_secret)
            .map_err(|e| {
                tracing::warn!(error = %e, "stripe webhook signature verification failed");
                AppError::BadRequest("Invalid webhook signature".to_string())
            })?;

    match event.type_ {
        stripe::EventType::CheckoutSessionCompleted => {
            if let stripe::EventObject::CheckoutSession(session) = event.data.object {
                let payment_intent_id = session
                    .payment_intent
                    .as_ref()
                    .map(|pi| pi.id().to_string());
                let customer_email = session
                    .customer_details
                    .as_ref()
                    .and_then(|d| d.email.clone());

                let mut conn = db::get_db_connection(&app_state)?;
                let updated = order_crud::mark_paid_by_session(
                    &mut conn,
                    session.id.as_str(),
                    payment_intent_id.as_deref(),
                    customer_email.as_deref(),
                )?;
                if updated {
                    tracing::info!(session_id = %session.id, "order marked paid");
                } else {
                    tracing::warn!(session_id = %session.id, "completed event for unknown or non-pending order");
                }
            }
        }
        stripe::EventType::CheckoutSessionExpired => {
            if let stripe::EventObject::CheckoutSession(session) = event.data.object {
                let mut conn = db::get_db_connection(&app_state)?;
                let released = order_crud::release_order_by_session(
                    &mut conn,
                    session.id.as_str(),
                    OrderStatus::Expired,
                )?;
                if !released {
                    if let Some(order_id) = order_id_from_metadata(&session) {
                        order_crud::release_order(&mut conn, order_id, OrderStatus::Expired)?;
                    }
                }
                tracing::info!(session_id = %session.id, "checkout session expired");
            }
        }
        // Unhandled event types are acknowledged so Stripe stops retrying them.
        _ => {}
    }

    Ok(StatusCode::OK)
}

async fn get_checkout_status(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<CheckoutStatus>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let enabled = settings_crud::is_checkout_enabled(&mut conn)?;
    Ok(Json(CheckoutStatus { enabled }))
}

async fn update_checkout_status(
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<CheckoutStatus>,
) -> Result<Json<CheckoutStatus>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    settings_crud::set_checkout_enabled(&mut conn, request.enabled)?;
    Ok(Json(CheckoutStatus {
        enabled: request.enabled,
    }))
}

async fn list_orders_admin(
    State(app_state): State<Arc<AppState>>,
    Query(query): Query<PageQuery>,
) -> Result<Json<PaginatedResponse<Order>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let page = query.resolve(20, 100);
    let total_count = order_crud::count_orders(&mut conn)?;
    let items = order_crud::list_orders(&mut conn, page.limit, page.offset)?;
    Ok(Json(PaginatedResponse {
        items,
        total_pages: pagination::total_pages(total_count, page.per_page),
    }))
}

async fn get_order_admin(
    State(app_state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<OrderWithItems>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let order = order_crud::get_order_with_items(&mut conn, order_id)?
        .ok_or_else(|| AppError::NotFound("Order not found".to_string()))?;
    Ok(Json(order))
}

pub fn public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/checkout/session", post(create_checkout_session))
        .route("/api/checkout/status", get(get_checkout_status))
}

pub fn webhook_router() -> Router<Arc<AppState>> {
    Router::new().route("/api/webhooks/stripe", post(stripe_webhook))
}

pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/orders", get(list_orders_admin))
        .route("/orders/{order_id}", get(get_order_admin))
        .route(
            "/settings/checkout",
            axum::routing::put(update_checkout_status),
        )
}
