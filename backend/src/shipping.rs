//! Delivery pricing and the rules checkout applies to the delivery chosen in
//! the cart: the flat rates in `shipping_rates`, the easybox weight limit,
//! and the locker snapshot taken from `sameday_lockers`.

use diesel::prelude::*;

use crate::enums::DeliveryMethod;
use crate::error::RepositoryError;
use crate::models::{DeliveryChoice, SamedayLocker, ShippingRate};
use crate::schema::{sameday_lockers, shipping_rates};

/// An easybox compartment takes at most 20 kg; the margin covers the box and
/// filling that `products.weight_grams` may underestimate.
pub const MAX_LOCKER_GRAMS: i64 = 18_000;
/// Largest shipping price or free threshold the admin can set, in bani.
const MAX_PRICE_CENTS: i64 = 100_000;
const MAX_FREE_FROM_CENTS: i64 = 10_000_000;

pub fn rates(conn: &mut PgConnection) -> QueryResult<Vec<ShippingRate>> {
    shipping_rates::table
        .order(shipping_rates::delivery_method.asc())
        .select(ShippingRate::as_select())
        .load(conn)
}

pub fn update_rate(conn: &mut PgConnection, rate: &ShippingRate) -> Result<(), RepositoryError> {
    if !(0..=MAX_PRICE_CENTS).contains(&rate.price_cents)
        || rate
            .free_from_cents
            .is_some_and(|free| !(1..=MAX_FREE_FROM_CENTS).contains(&free))
    {
        return Err(RepositoryError::BadRequest(
            "Shipping price or free-shipping threshold is out of range".to_string(),
        ));
    }
    diesel::update(shipping_rates::table.find(rate.delivery_method))
        .set((
            shipping_rates::price_cents.eq(rate.price_cents),
            shipping_rates::free_from_cents.eq(rate.free_from_cents),
            shipping_rates::enabled.eq(rate.enabled),
        ))
        .execute(conn)?;
    Ok(())
}

impl ShippingRate {
    /// What the customer pays for delivery of `products_cents` worth of products.
    pub fn price_for(&self, products_cents: i64) -> i64 {
        match self.free_from_cents {
            Some(free_from) if products_cents >= free_from => 0,
            _ => self.price_cents,
        }
    }
}

/// Delivery fields of a new order, resolved from the customer's choice.
pub struct ResolvedDelivery {
    pub method: DeliveryMethod,
    pub shipping_cents: i64,
    pub locker: Option<SamedayLocker>,
}

/// Checks the delivery chosen in the cart against the enabled rates, the
/// synced lockers and the easybox weight limit, and prices it.
/// `easybox_available` is false while Sameday is not configured.
pub fn resolve_delivery(
    conn: &mut PgConnection,
    choice: DeliveryChoice,
    easybox_available: bool,
    products_cents: i64,
    parcel_grams: i64,
) -> Result<ResolvedDelivery, RepositoryError> {
    let method = choice.method();
    let rate: Option<ShippingRate> = shipping_rates::table
        .find(method)
        .filter(shipping_rates::enabled)
        .select(ShippingRate::as_select())
        .first(conn)
        .optional()?;
    let unavailable =
        || RepositoryError::BadRequest("This delivery method is not available".to_string());
    let rate = rate.ok_or_else(unavailable)?;

    let locker = match choice {
        DeliveryChoice::Home => None,
        DeliveryChoice::Easybox { locker_id } => {
            if !easybox_available {
                return Err(unavailable());
            }
            if parcel_grams > MAX_LOCKER_GRAMS {
                return Err(RepositoryError::BadRequest(
                    "This order is too heavy for an easybox locker".to_string(),
                ));
            }
            let locker = sameday_lockers::table
                .find(locker_id)
                .select(SamedayLocker::as_select())
                .first(conn)
                .optional()?
                .ok_or_else(|| RepositoryError::BadRequest("Unknown easybox locker".to_string()))?;
            Some(locker)
        }
    };

    Ok(ResolvedDelivery {
        method,
        shipping_cents: rate.price_for(products_cents),
        locker,
    })
}

pub fn has_lockers(conn: &mut PgConnection) -> QueryResult<bool> {
    diesel::select(diesel::dsl::exists(
        sameday_lockers::table.select(sameday_lockers::locker_id),
    ))
    .get_result(conn)
}

/// Replaces the locker cache with Sameday's current list: lockers no longer
/// listed are removed so checkout can't pick them.
pub fn replace_lockers(conn: &mut PgConnection, lockers: &[SamedayLocker]) -> QueryResult<usize> {
    conn.transaction(|conn| {
        let ids: Vec<i32> = lockers.iter().map(|l| l.locker_id).collect();
        let removed =
            diesel::delete(sameday_lockers::table.filter(sameday_lockers::locker_id.ne_all(&ids)))
                .execute(conn)?;
        for chunk in lockers.chunks(1000) {
            diesel::insert_into(sameday_lockers::table)
                .values(chunk)
                .on_conflict(sameday_lockers::locker_id)
                .do_update()
                .set((
                    sameday_lockers::name.eq(diesel::upsert::excluded(sameday_lockers::name)),
                    sameday_lockers::county.eq(diesel::upsert::excluded(sameday_lockers::county)),
                    sameday_lockers::city.eq(diesel::upsert::excluded(sameday_lockers::city)),
                    sameday_lockers::address.eq(diesel::upsert::excluded(sameday_lockers::address)),
                    sameday_lockers::postal_code
                        .eq(diesel::upsert::excluded(sameday_lockers::postal_code)),
                    sameday_lockers::synced_at
                        .eq(diesel::upsert::excluded(sameday_lockers::synced_at)),
                ))
                .execute(conn)?;
        }
        Ok(removed)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rate(price_cents: i64, free_from_cents: Option<i64>) -> ShippingRate {
        ShippingRate {
            delivery_method: DeliveryMethod::Home,
            price_cents,
            free_from_cents,
            enabled: true,
        }
    }

    #[test]
    fn free_from_threshold_inclusive() {
        let r = rate(2000, Some(25000));
        assert_eq!(r.price_for(24999), 2000);
        assert_eq!(r.price_for(25000), 0);
        assert_eq!(r.price_for(90000), 0);
    }

    #[test]
    fn never_free_without_threshold() {
        assert_eq!(rate(1500, None).price_for(10_000_000), 1500);
    }
}
