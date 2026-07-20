use crate::enums::OrderStatus;
use crate::error::RepositoryError;
use crate::language::Language;
use crate::models::{CheckoutItem, NewOrder, NewOrderItem, Order, OrderItem, OrderWithItems};
use crate::schema::*;
use diesel::prelude::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use uuid::Uuid;

pub const MAX_CHECKOUT_ITEMS: usize = 20;
pub const MAX_ITEM_QUANTITY: i32 = 99;

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
    for item in items {
        if item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY {
            return Err(RepositoryError::BadRequest(format!(
                "Quantity for product {} must be between 1 and {}",
                item.product_id, MAX_ITEM_QUANTITY
            )));
        }
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

/// Creates a pending order, snapshotting name/price in the request language,
/// and atomically reserves stock for every line. Fails with `Conflict` if any
/// product is missing, deleted, or short on stock — nothing is reserved then.
pub fn create_pending_order(
    conn: &mut PgConnection,
    items: &[CheckoutItem],
    language: Language,
) -> Result<OrderWithItems, RepositoryError> {
    validate_checkout_items(items)?;

    conn.transaction(|conn| {
        let mut total_cents: i64 = 0;
        let mut new_items: Vec<NewOrderItem> = Vec::with_capacity(items.len());

        for item in items {
            // Conditional decrement doubles as the stock check: 0 rows updated
            // means "not found, deleted, or insufficient stock", and the
            // transaction rollback releases any earlier reservations.
            let reserved: Option<(String, String, Decimal, Decimal)> = diesel::update(
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
                products::price,
                products::price_ron,
            ))
            .get_result(conn)
            .optional()?;

            let (name_en, name_ro, price_eur, price_ron) = reserved.ok_or_else(|| {
                RepositoryError::Conflict(format!(
                    "Insufficient stock for product {}",
                    item.product_id
                ))
            })?;

            let (product_name, unit_price) = match language {
                Language::En => (name_en, price_eur),
                Language::Ro => (name_ro, price_ron),
            };
            let unit_amount_cents = amount_cents(unit_price)?;
            total_cents += unit_amount_cents * i64::from(item.quantity);

            new_items.push(NewOrderItem {
                order_id: Uuid::nil(), // patched after the order row exists
                product_id: item.product_id.clone(),
                product_name,
                unit_amount_cents,
                quantity: item.quantity,
            });
        }

        let (currency, language_code) = match language {
            Language::En => ("EUR", "en"),
            Language::Ro => ("RON", "ro"),
        };

        let order: Order = diesel::insert_into(orders::table)
            .values(&NewOrder {
                currency: currency.to_string(),
                total_amount_cents: total_cents,
                language: language_code.to_string(),
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

/// Marks a pending order as paid. Returns `false` when no pending order
/// matches the session — the idempotency guard for webhook retries.
pub fn mark_paid_by_session(
    conn: &mut PgConnection,
    session_id: &str,
    payment_intent_id: Option<&str>,
    customer_email: Option<&str>,
) -> Result<bool, RepositoryError> {
    let updated = diesel::update(
        orders::table.filter(
            orders::stripe_session_id
                .eq(session_id)
                .and(orders::status.eq(OrderStatus::Pending)),
        ),
    )
    .set((
        orders::status.eq(OrderStatus::Paid),
        orders::stripe_payment_intent_id.eq(payment_intent_id),
        orders::customer_email.eq(customer_email),
    ))
    .execute(conn)?;
    Ok(updated > 0)
}

/// Moves a pending order to `new_status` (Expired/Failed) and restores the
/// stock it had reserved. Idempotent: does nothing (returns `false`) unless
/// the order is still pending, so webhook retries can't restore stock twice.
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
                    .and(orders::status.eq(OrderStatus::Pending)),
            ),
        )
        .set(orders::status.eq(new_status))
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

pub fn release_order_by_session(
    conn: &mut PgConnection,
    session_id: &str,
    new_status: OrderStatus,
) -> Result<bool, RepositoryError> {
    let id: Option<Uuid> = orders::table
        .filter(orders::stripe_session_id.eq(session_id))
        .select(orders::order_id)
        .first(conn)
        .optional()?;
    match id {
        Some(id) => release_order(conn, id, new_status),
        None => Ok(false),
    }
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
