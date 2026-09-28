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

/// Applies a completed session: `Paid` if the money has moved, `Processing`
/// if a delayed payment method is still settling.
pub fn apply_completed_session(
    conn: &mut PgConnection,
    order_id: Uuid,
    session: &stripe::CheckoutSession,
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
async fn release_hold(
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
            apply_completed_session(&mut conn, order_id, &session)?;
        }
        // Still open (a transient Stripe error): retried on the next sweep.
        _ => tracing::warn!(%order_id, "stripe session still open after expire attempt"),
    }
    Ok(())
}
