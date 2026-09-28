//! Stripe Checkout Session → order state transitions, shared by the webhook
//! and the reservation sweeper so both apply exactly the same rules.

use std::sync::Arc;
use std::time::Duration;

use diesel::PgConnection;
use uuid::Uuid;

use crate::AppState;
use crate::db;
use crate::enums::OrderStatus;
use crate::error::RepositoryError;
use crate::models::ShippingDetails;
use crate::order_crud;

const SWEEP_INTERVAL: Duration = Duration::from_secs(60);
/// Upper bound on Stripe calls per sweep; any remainder is handled next tick.
const SWEEP_BATCH: i64 = 50;

/// Fallback for sessions that were never attached to their order (e.g. the
/// attach write failed): recover the order id from the session metadata.
pub fn order_id_from_metadata(session: &stripe::CheckoutSession) -> Option<Uuid> {
    session
        .metadata
        .as_ref()
        .and_then(|m| m.get("order_id"))
        .and_then(|s| Uuid::parse_str(s).ok())
}

/// Trimmed, non-empty string at `key`, cut to `max` characters so it always
/// fits its column.
fn json_str(value: Option<&serde_json::Value>, key: &str, max: usize) -> Option<String> {
    value
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(max).collect())
}

/// Delivery details of a Checkout Session given as JSON. Webhook payloads are
/// rendered in the webhook endpoint's API version, not the library's, so both
/// layouts are accepted: `shipping_details` at the top level (API versions
/// before 2025-03-31) and `collected_information.shipping_details` (newer).
pub fn shipping_from_session_json(session: &serde_json::Value) -> ShippingDetails {
    let not_null = |v: &&serde_json::Value| !v.is_null();
    let shipping = session
        .pointer("/collected_information/shipping_details")
        .filter(not_null)
        .or_else(|| session.get("shipping_details").filter(not_null));
    let address = shipping.and_then(|s| s.get("address")).filter(not_null);
    let customer = session.get("customer_details").filter(not_null);

    ShippingDetails {
        shipping_name: json_str(shipping, "name", 255).or_else(|| json_str(customer, "name", 255)),
        shipping_phone: json_str(customer, "phone", 64).or_else(|| json_str(shipping, "phone", 64)),
        shipping_line1: json_str(address, "line1", 255),
        shipping_line2: json_str(address, "line2", 255),
        shipping_city: json_str(address, "city", 255),
        shipping_state: json_str(address, "state", 255),
        shipping_postal_code: json_str(address, "postal_code", 32),
        shipping_country: json_str(address, "country", 2),
    }
}

/// Delivery details of a session fetched through the library (API version
/// pinned by async-stripe).
pub fn shipping_from_session(session: &stripe::CheckoutSession) -> ShippingDetails {
    serde_json::to_value(session)
        .map(|v| shipping_from_session_json(&v))
        .unwrap_or_default()
}

/// Applies a completed session: `Paid` if the money has moved, `Processing`
/// if a delayed payment method is still settling.
pub fn apply_completed_session(
    conn: &mut PgConnection,
    order_id: Uuid,
    session: &stripe::CheckoutSession,
    shipping: &ShippingDetails,
) -> Result<bool, RepositoryError> {
    let settled = matches!(
        session.payment_status,
        stripe::CheckoutSessionPaymentStatus::Paid
            | stripe::CheckoutSessionPaymentStatus::NoPaymentRequired
    );
    let payment_intent_id = session
        .payment_intent
        .as_ref()
        .map(|pi| pi.id().to_string());
    let customer_email = session
        .customer_details
        .as_ref()
        .and_then(|d| d.email.as_deref());
    order_crud::record_payment(
        conn,
        order_id,
        payment_intent_id.as_deref(),
        customer_email,
        shipping,
        settled,
    )
}

/// Releases the stock of checkouts left unfinished for longer than
/// `order_crud::HOLD_SECS`. Also the safety net for anything that left an
/// order pending: a crash between reserving stock and creating the session,
/// a failed release on an error path, or a webhook that never arrived.
pub async fn run_reservation_sweeper(app_state: Arc<AppState>) {
    let mut interval = tokio::time::interval(SWEEP_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        if let Err(e) = sweep_expired_holds(&app_state).await {
            tracing::error!(error = ?e, "reservation sweep failed");
        }
    }
}

async fn sweep_expired_holds(app_state: &Arc<AppState>) -> Result<(), crate::AppError> {
    let holds = {
        let mut conn = db::get_db_connection(app_state)?;
        order_crud::expired_holds(&mut conn, SWEEP_BATCH)?
    };
    for (order_id, session_id) in holds {
        if let Err(e) = release_hold(app_state, order_id, session_id.as_deref()).await {
            tracing::error!(error = ?e, %order_id, "failed to release expired hold");
        }
    }
    Ok(())
}

/// Expires the order's Stripe session before releasing its stock, so the
/// customer can never pay for bottles that were handed back. If the session
/// can't be expired because the customer finished paying in the meantime, the
/// completion is applied instead of the release.
pub async fn release_hold(
    app_state: &Arc<AppState>,
    order_id: Uuid,
    session_id: Option<&str>,
) -> Result<(), crate::AppError> {
    let Some(session_id) = session_id else {
        let mut conn = db::get_db_connection(app_state)?;
        if order_crud::release_order(&mut conn, order_id, OrderStatus::Failed)? {
            tracing::warn!(%order_id, "released hold of order that never got a stripe session");
        }
        return Ok(());
    };

    let session_id: stripe::CheckoutSessionId = session_id.parse().map_err(|_| {
        crate::AppError::InternalServerError(format!("invalid stored session id {session_id}"))
    })?;
    let client = &app_state.stripe_client;

    let session = match stripe::CheckoutSession::expire(client, &session_id).await {
        Ok(session) => session,
        // Expiring fails once the session is no longer open; look up why.
        Err(expire_err) => stripe::CheckoutSession::retrieve(client, &session_id, &[])
            .await
            .map_err(|e| {
                crate::AppError::InternalServerError(format!(
                    "could not expire ({expire_err}) or retrieve ({e}) stripe session"
                ))
            })?,
    };

    let mut conn = db::get_db_connection(app_state)?;
    match session.status {
        Some(stripe::CheckoutSessionStatus::Expired) => {
            if order_crud::release_order(&mut conn, order_id, OrderStatus::Expired)? {
                tracing::info!(%order_id, "released stock of abandoned checkout");
            }
        }
        Some(stripe::CheckoutSessionStatus::Complete) => {
            let shipping = shipping_from_session(&session);
            apply_completed_session(&mut conn, order_id, &session, &shipping)?;
        }
        // Still open (a transient Stripe error): retried on the next sweep.
        _ => tracing::warn!(%order_id, "stripe session still open after expire attempt"),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shipping_from_legacy_layout() {
        let session = serde_json::json!({
            "customer_details": {"name": "Ana Pop", "phone": "+40722000000", "email": "a@b.ro"},
            "shipping_details": {
                "name": "Ana Pop",
                "address": {"line1": "Str. Florilor 1", "line2": null, "city": "Ploiești",
                            "state": "Prahova", "postal_code": "100001", "country": "RO"}
            }
        });
        let s = shipping_from_session_json(&session);
        assert_eq!(s.shipping_name.as_deref(), Some("Ana Pop"));
        assert_eq!(s.shipping_phone.as_deref(), Some("+40722000000"));
        assert_eq!(s.shipping_line1.as_deref(), Some("Str. Florilor 1"));
        assert_eq!(s.shipping_line2, None);
        assert_eq!(s.shipping_city.as_deref(), Some("Ploiești"));
        assert_eq!(s.shipping_country.as_deref(), Some("RO"));
    }

    #[test]
    fn shipping_from_collected_information_layout() {
        let session = serde_json::json!({
            "customer_details": {"phone": "+40722000001"},
            "shipping_details": null,
            "collected_information": {"shipping_details": {
                "name": "Ion Ionescu",
                "address": {"line1": "Bd. Unirii 2", "city": "București", "country": "RO",
                            "postal_code": "030000", "state": "București"}
            }}
        });
        let s = shipping_from_session_json(&session);
        assert_eq!(s.shipping_name.as_deref(), Some("Ion Ionescu"));
        assert_eq!(s.shipping_phone.as_deref(), Some("+40722000001"));
        assert_eq!(s.shipping_line1.as_deref(), Some("Bd. Unirii 2"));
    }

    #[test]
    fn shipping_missing_is_empty_and_values_are_truncated() {
        assert_eq!(shipping_from_session_json(&serde_json::json!({})), ShippingDetails::default());
        let long = "x".repeat(300);
        let s = shipping_from_session_json(&serde_json::json!({
            "shipping_details": {"name": long, "address": {"country": "ROU"}}
        }));
        assert_eq!(s.shipping_name.map(|n| n.chars().count()), Some(255));
        assert_eq!(s.shipping_country.as_deref(), Some("RO"));
    }
}
