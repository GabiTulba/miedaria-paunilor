use crate::enums::OrderStatus;
use crate::error::RepositoryError;
use crate::language::Language;
use crate::models::{
    CheckoutItem, NewOrder, NewOrderItem, Order, OrderItem, OrderWithItems, ShippingDetails,
};
use crate::schema::*;
use diesel::prelude::*;
use diesel::sql_types::Text;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use uuid::Uuid;

pub const MAX_CHECKOUT_ITEMS: usize = 20;
/// Total bottles across all lines of one order. Mirror of `MAX_ORDER_BOTTLES`
/// in frontend/src/utils/stockAvailability.ts.
pub const MAX_ORDER_BOTTLES: i32 = 100;
/// Pending orders hold real stock, so one client may only have this many
/// reservations open at once — otherwise anyone could mark the whole catalog
/// as sold out by starting checkouts and never paying.
pub const MAX_PENDING_ORDERS_PER_CLIENT: i64 = 2;
/// How long an unfinished checkout holds its stock. Stripe will not let a
/// Checkout Session expire on its own sooner than 30 minutes, so the
/// reservation sweeper expires the session itself once this elapses.
pub const HOLD_SECS: i64 = 15 * 60;
/// Statuses in which an order still holds reserved stock.
const RESERVING_STATUSES: [OrderStatus; 2] = [OrderStatus::Pending, OrderStatus::Processing];

fn validate_checkout_items(items: &[CheckoutItem]) -> Result<(), RepositoryError> {
    if items.is_empty() {
        return Err(RepositoryError::BadRequest(
            "Checkout requires at least one item".to_string(),
        ));
    }
    if items.len() > MAX_CHECKOUT_ITEMS {
        return Err(RepositoryError::BadRequest(format!(
            "Checkout is limited to {} distinct products",
            MAX_CHECKOUT_ITEMS
        )));
    }
    if items.iter().any(|item| item.quantity < 1) {
        return Err(RepositoryError::BadRequest(
            "Every checkout item needs a quantity of at least 1".to_string(),
        ));
    }
    let total_bottles = items
        .iter()
        .try_fold(0i32, |sum, item| sum.checked_add(item.quantity));
    if total_bottles.is_none_or(|total| total > MAX_ORDER_BOTTLES) {
        return Err(RepositoryError::BadRequest(format!(
            "An order is limited to {} bottles",
            MAX_ORDER_BOTTLES
        )));
    }
    let mut ids: Vec<&str> = items.iter().map(|i| i.product_id.as_str()).collect();
    ids.sort_unstable();
    if ids.windows(2).any(|w| w[0] == w[1]) {
        return Err(RepositoryError::BadRequest(
            "Duplicate product in checkout items".to_string(),
        ));
    }
    Ok(())
}

fn amount_cents(price: Decimal) -> Result<i64, RepositoryError> {
    // DECIMAL(7,2) * 100 is always integral, so to_i64 cannot lose precision.
    (price * Decimal::from(100)).to_i64().ok_or_else(|| {
        RepositoryError::BadRequest("Product price cannot be represented in cents".to_string())
    })
}

/// Creates a pending order, snapshotting the name in the request language,
/// and atomically reserves stock for every line. All orders are charged in
/// RON — the only currency prices are set in; EUR amounts shown on the
/// English site are indicative conversions. Fails with `TooManyRequests` if
/// the client already holds `MAX_PENDING_ORDERS_PER_CLIENT` live reservations,
/// and with `Conflict` if any product is missing, deleted, or short on stock —
/// nothing is reserved then.
pub fn create_pending_order(
    conn: &mut PgConnection,
    items: &[CheckoutItem],
    language: Language,
    client_key_hash: &str,
) -> Result<OrderWithItems, RepositoryError> {
    validate_checkout_items(items)?;

    conn.transaction(|conn| {
        // Serializes concurrent checkouts from the same client so they can't
        // both pass the pending-order count below.
        diesel::sql_query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind::<Text, _>(client_key_hash)
            .execute(conn)?;

        let reservation_start = chrono::Utc::now() - chrono::Duration::seconds(HOLD_SECS);
        let live_reservations: i64 = orders::table
            .filter(
                orders::client_key_hash
                    .eq(client_key_hash)
                    .and(orders::status.eq(OrderStatus::Pending))
                    .and(orders::created_at.gt(reservation_start)),
            )
            .count()
            .get_result(conn)?;
        if live_reservations >= MAX_PENDING_ORDERS_PER_CLIENT {
            return Err(RepositoryError::TooManyRequests);
        }

        let mut total_cents: i64 = 0;
        let mut new_items: Vec<NewOrderItem> = Vec::with_capacity(items.len());

        for item in items {
            // Conditional decrement doubles as the stock check: 0 rows updated
            // means "not found, deleted, or insufficient stock", and the
            // transaction rollback releases any earlier reservations.
            let reserved: Option<(String, String, Decimal)> = diesel::update(
                products::table.filter(
                    products::product_id
                        .eq(&item.product_id)
                        .and(products::deleted_at.is_null())
                        .and(products::bottle_count.ge(item.quantity)),
                ),
            )
            .set(products::bottle_count.eq(products::bottle_count - item.quantity))
            .returning((
                products::product_name,
                products::product_name_ro,
                products::price_ron,
            ))
            .get_result(conn)
            .optional()?;

            let (name_en, name_ro, price_ron) = reserved.ok_or_else(|| {
                RepositoryError::Conflict(format!(
                    "Insufficient stock for product {}",
                    item.product_id
                ))
            })?;

            let product_name = match language {
                Language::En => name_en,
                Language::Ro => name_ro,
            };
            let unit_amount_cents = amount_cents(price_ron)?;
            total_cents += unit_amount_cents * i64::from(item.quantity);

            new_items.push(NewOrderItem {
                order_id: Uuid::nil(), // patched after the order row exists
                product_id: item.product_id.clone(),
                product_name,
                unit_amount_cents,
                quantity: item.quantity,
            });
        }

        let currency = "RON";
        let language_code = match language {
            Language::En => "en",
            Language::Ro => "ro",
        };

        let order: Order = diesel::insert_into(orders::table)
            .values(&NewOrder {
                currency: currency.to_string(),
                total_amount_cents: total_cents,
                language: language_code.to_string(),
                client_key_hash: client_key_hash.to_string(),
            })
            .returning(Order::as_returning())
            .get_result(conn)?;

        for item in &mut new_items {
            item.order_id = order.order_id;
        }

        let items: Vec<OrderItem> = diesel::insert_into(order_items::table)
            .values(&new_items)
            .returning(OrderItem::as_returning())
            .get_results(conn)?;

        Ok(OrderWithItems { order, items })
    })
}

pub fn attach_stripe_session(
    conn: &mut PgConnection,
    id: Uuid,
    session_id: &str,
) -> Result<(), RepositoryError> {
    diesel::update(orders::table.filter(orders::order_id.eq(id)))
        .set(orders::stripe_session_id.eq(session_id))
        .execute(conn)?;
    Ok(())
}

/// Resolves the order a Checkout Session belongs to: by the attached session
/// id, falling back to the signed session metadata for sessions whose attach
/// write never landed.
pub fn find_order_id_for_session(
    conn: &mut PgConnection,
    session_id: &str,
    metadata_order_id: Option<Uuid>,
) -> Result<Option<Uuid>, RepositoryError> {
    let attached: Option<Uuid> = orders::table
        .filter(orders::stripe_session_id.eq(session_id))
        .select(orders::order_id)
        .first(conn)
        .optional()?;
    Ok(attached.or(metadata_order_id))
}

/// Records the payment details of a completed session and moves the order
/// out of `Pending`: to `Paid` when `settled`, otherwise to `Processing`,
/// keeping its stock reserved until Stripe reports the delayed payment's
/// outcome. Returns `false` when the order is not pending — the idempotency
/// guard for webhook retries and the sweeper racing the webhook.
pub fn record_payment(
    conn: &mut PgConnection,
    id: Uuid,
    payment_intent_id: Option<&str>,
    customer_email: Option<&str>,
    shipping: &ShippingDetails,
    settled: bool,
) -> Result<bool, RepositoryError> {
    let new_status = if settled {
        OrderStatus::Paid
    } else {
        OrderStatus::Processing
    };
    let updated = diesel::update(
        orders::table.filter(
            orders::order_id
                .eq(id)
                .and(orders::status.eq(OrderStatus::Pending)),
        ),
    )
    .set((
        orders::status.eq(new_status),
        orders::stripe_payment_intent_id.eq(payment_intent_id),
        orders::customer_email.eq(customer_email),
        orders::client_key_hash.eq(None::<String>),
        shipping,
    ))
    .execute(conn)?;
    Ok(updated > 0)
}

/// Moves an order whose delayed payment has cleared to `Paid`. Returns
/// `false` unless the order was still holding stock.
pub fn mark_paid(conn: &mut PgConnection, id: Uuid) -> Result<bool, RepositoryError> {
    let updated = diesel::update(
        orders::table.filter(
            orders::order_id
                .eq(id)
                .and(orders::status.eq_any(RESERVING_STATUSES)),
        ),
    )
    .set((
        orders::status.eq(OrderStatus::Paid),
        orders::client_key_hash.eq(None::<String>),
    ))
    .execute(conn)?;
    Ok(updated > 0)
}

/// Moves an order that still holds stock to `new_status` (Expired/Failed)
/// and restores that stock. Idempotent: does nothing (returns `false`) once
/// the order has left `Pending`/`Processing`, so retries and races between
/// the webhook and the sweeper can't restore stock twice.
pub fn release_order(
    conn: &mut PgConnection,
    id: Uuid,
    new_status: OrderStatus,
) -> Result<bool, RepositoryError> {
    conn.transaction(|conn| {
        let flipped = diesel::update(
            orders::table.filter(
                orders::order_id
                    .eq(id)
                    .and(orders::status.eq_any(RESERVING_STATUSES)),
            ),
        )
        .set((
            orders::status.eq(new_status),
            orders::client_key_hash.eq(None::<String>),
        ))
        .execute(conn)?;

        if flipped == 0 {
            return Ok(false);
        }

        let items: Vec<OrderItem> = order_items::table
            .filter(order_items::order_id.eq(id))
            .select(OrderItem::as_select())
            .load(conn)?;

        for item in &items {
            diesel::update(products::table.filter(products::product_id.eq(&item.product_id)))
                .set(products::bottle_count.eq(products::bottle_count + item.quantity))
                .execute(conn)?;
        }

        Ok(true)
    })
}

/// Stripe session of an order that still holds stock as `Pending`, or `None`
/// when the order is unknown or already past that state. `Some(None)` means
/// pending without a session (creation never finished).
pub fn pending_session(
    conn: &mut PgConnection,
    id: Uuid,
) -> QueryResult<Option<Option<String>>> {
    orders::table
        .filter(
            orders::order_id
                .eq(id)
                .and(orders::status.eq(OrderStatus::Pending)),
        )
        .select(orders::stripe_session_id)
        .first(conn)
        .optional()
}

/// Pending orders whose hold has run out, oldest first, with their Stripe
/// session id (absent if session creation never completed).
pub fn expired_holds(
    conn: &mut PgConnection,
    limit: i64,
) -> QueryResult<Vec<(Uuid, Option<String>)>> {
    let cutoff = chrono::Utc::now() - chrono::Duration::seconds(HOLD_SECS);
    orders::table
        .filter(
            orders::status
                .eq(OrderStatus::Pending)
                .and(orders::created_at.lt(cutoff)),
        )
        .order(orders::created_at.asc())
        .limit(limit)
        .select((orders::order_id, orders::stripe_session_id))
        .load(conn)
}

pub fn count_orders(conn: &mut PgConnection) -> QueryResult<i64> {
    orders::table.count().get_result(conn)
}

pub fn list_orders(conn: &mut PgConnection, limit: i64, offset: i64) -> QueryResult<Vec<Order>> {
    orders::table
        .order(orders::created_at.desc())
        .limit(limit)
        .offset(offset)
        .select(Order::as_select())
        .load(conn)
}

pub fn get_order_with_items(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<Option<OrderWithItems>, RepositoryError> {
    let order: Option<Order> = orders::table
        .filter(orders::order_id.eq(id))
        .select(Order::as_select())
        .first(conn)
        .optional()?;

    let Some(order) = order else {
        return Ok(None);
    };

    let items: Vec<OrderItem> = order_items::table
        .filter(order_items::order_id.eq(id))
        .select(OrderItem::as_select())
        .load(conn)?;

    Ok(Some(OrderWithItems { order, items }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(product_id: &str, quantity: i32) -> CheckoutItem {
        CheckoutItem {
            product_id: product_id.to_string(),
            quantity,
        }
    }

    #[test]
    fn accepts_order_at_bottle_cap() {
        let items = [item("a", MAX_ORDER_BOTTLES - 1), item("b", 1)];
        assert!(validate_checkout_items(&items).is_ok());
    }

    #[test]
    fn rejects_order_over_bottle_cap() {
        let items = [item("a", MAX_ORDER_BOTTLES), item("b", 1)];
        assert!(validate_checkout_items(&items).is_err());
    }

    #[test]
    fn rejects_quantity_overflow() {
        let items = [item("a", i32::MAX), item("b", i32::MAX)];
        assert!(validate_checkout_items(&items).is_err());
    }

    #[test]
    fn rejects_non_positive_quantity() {
        assert!(validate_checkout_items(&[item("a", 0)]).is_err());
        assert!(validate_checkout_items(&[item("a", -3)]).is_err());
    }

    #[test]
    fn rejects_duplicate_products() {
        assert!(validate_checkout_items(&[item("a", 1), item("a", 1)]).is_err());
    }
}
