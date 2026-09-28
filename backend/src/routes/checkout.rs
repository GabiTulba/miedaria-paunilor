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
use crate::auth;
use crate::db;
use crate::enums::OrderStatus;
use crate::language::Language;
use crate::models::{
    CancelCheckoutRequest, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatus, Order, OrderWithItems,
    PaginatedResponse,
};
use crate::order_crud;
use crate::pagination::{self, PageQuery};
use crate::settings_crud;
use crate::stripe_checkout;

/// Stripe's minimum Checkout Session lifetime. Our own hold is shorter
/// (`order_crud::HOLD_SECS`); the reservation sweeper expires the session early.
const STRIPE_SESSION_EXPIRY_SECS: i64 = 30 * 60;

async fn create_checkout_session(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    lang: Language,
    Json(request): Json<CheckoutSessionRequest>,
) -> Result<Json<CheckoutSessionResponse>, AppError> {
    let client_ip = auth::extract_client_ip(&headers);
    app_state
        .checkout_limiter
        .check_key(&auth::client_network(client_ip))
        .map_err(|_| AppError::TooManyRequests)?;

    let OrderWithItems { order, items } = {
        let mut conn = db::get_db_connection(&app_state)?;
        if !settings_crud::is_checkout_enabled(&mut conn)? {
            return Err(AppError::ServiceUnavailable(
                "Checkout is temporarily disabled".to_string(),
            ));
        }
        order_crud::create_pending_order(
            &mut conn,
            &request.items,
            lang,
            &app_state.client_key_hash(client_ip),
        )?
    };

    // All orders are charged in RON regardless of site language; the EUR
    // amounts shown on the English site are indicative BNR conversions.
    let currency = stripe::Currency::RON;
    let lang_code = match lang {
        Language::En => "en",
        Language::Ro => "ro",
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
    // The order id lets the cart release this checkout's stock right away
    // instead of holding it until the sweeper's timeout.
    let cancel_url = format!(
        "{}/{}/cart?checkout_cancelled={}",
        app_state.site_url, lang_code, order.order_id
    );

    let mut params = stripe::CreateCheckoutSession::new();
    params.mode = Some(stripe::CheckoutSessionMode::Payment);
    params.line_items = Some(line_items);
    params.success_url = Some(&success_url);
    params.cancel_url = Some(&cancel_url);
    params.client_reference_id = Some(&order_id_str);
    params.expires_at = Some(chrono::Utc::now().timestamp() + STRIPE_SESSION_EXPIRY_SECS);
    // Bottles are shipped, so every order needs a delivery address and a phone
    // number for the courier. Delivery is Romania-only for now.
    params.shipping_address_collection = Some(stripe::CreateCheckoutSessionShippingAddressCollection {
        allowed_countries: vec![
            stripe::CreateCheckoutSessionShippingAddressCollectionAllowedCountries::Ro,
        ],
    });
    params.phone_number_collection =
        Some(stripe::CreateCheckoutSessionPhoneNumberCollection { enabled: true });
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
        // Expire the session first so it can never be paid for an order whose
        // stock has already been handed back.
        if let Err(e) = stripe::CheckoutSession::expire(&app_state.stripe_client, &session.id).await
        {
            tracing::error!(error = %e, order_id = %order.order_id, "failed to expire orphaned stripe session");
        }
        order_crud::release_order(&mut conn, order.order_id, OrderStatus::Failed)?;
        return Err(AppError::InternalServerError(
            "Could not start checkout. Please try again.".to_string(),
        ));
    };

    Ok(Json(CheckoutSessionResponse {
        url,
        order_id: order.order_id,
    }))
}

/// Releases the stock of a checkout the customer walked away from (Stripe's
/// back link, or the browser's Back button). Expires the Stripe session first;
/// if the customer actually finished paying, the payment is recorded instead.
/// Always answers 204 so it reveals nothing about other orders.
async fn cancel_checkout(
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<CancelCheckoutRequest>,
) -> Result<StatusCode, AppError> {
    let session_id = {
        let mut conn = db::get_db_connection(&app_state)?;
        order_crud::pending_session(&mut conn, request.order_id)?
    };
    if let Some(session_id) = session_id {
        stripe_checkout::release_hold(&app_state, request.order_id, session_id.as_deref())
            .await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

fn checkout_session(event: stripe::Event) -> Option<stripe::CheckoutSession> {
    match event.data.object {
        stripe::EventObject::CheckoutSession(session) => Some(session),
        _ => None,
    }
}

/// Handles the Checkout Session lifecycle. `completed` only means the customer
/// finished the Stripe page: for delayed payment methods the money has not
/// moved yet (`payment_status == unpaid`), so the order becomes `Processing`
/// with its stock reserved until `async_payment_succeeded` / `async_payment_failed`.
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

    // Parsed separately from the typed event: the typed struct follows the
    // library's pinned API version, which may not match the endpoint's.
    let shipping = serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|v| v.pointer("/data/object").cloned())
        .map(|obj| stripe_checkout::shipping_from_session_json(&obj))
        .unwrap_or_default();

    let event_type = event.type_;
    let handled = matches!(
        event_type,
        stripe::EventType::CheckoutSessionCompleted
            | stripe::EventType::CheckoutSessionAsyncPaymentSucceeded
            | stripe::EventType::CheckoutSessionAsyncPaymentFailed
            | stripe::EventType::CheckoutSessionExpired
    );
    // Unhandled event types are acknowledged so Stripe stops retrying them.
    let Some(session) = checkout_session(event).filter(|_| handled) else {
        return Ok(StatusCode::OK);
    };

    let mut conn = db::get_db_connection(&app_state)?;
    let Some(order_id) = order_crud::find_order_id_for_session(
        &mut conn,
        session.id.as_str(),
        stripe_checkout::order_id_from_metadata(&session),
    )?
    else {
        tracing::warn!(session_id = %session.id, event = %event_type, "webhook for unknown order");
        return Ok(StatusCode::OK);
    };

    let applied = match event_type {
        stripe::EventType::CheckoutSessionCompleted => {
            let shipping = if shipping == Default::default() {
                stripe_checkout::shipping_from_session(&session)
            } else {
                shipping
            };
            stripe_checkout::apply_completed_session(&mut conn, order_id, &session, &shipping)?
        }
        stripe::EventType::CheckoutSessionAsyncPaymentSucceeded => {
            order_crud::mark_paid(&mut conn, order_id)?
        }
        stripe::EventType::CheckoutSessionAsyncPaymentFailed => {
            order_crud::release_order(&mut conn, order_id, OrderStatus::Failed)?
        }
        _ => order_crud::release_order(&mut conn, order_id, OrderStatus::Expired)?,
    };

    tracing::info!(
        session_id = %session.id,
        %order_id,
        event = %event_type,
        payment_status = %session.payment_status,
        applied,
        "stripe checkout event processed"
    );
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
        .route("/api/checkout/cancel", post(cancel_checkout))
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
