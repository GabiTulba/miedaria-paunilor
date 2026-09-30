//! Sameday waybills (AWBs) for paid orders: created by an admin once the
//! parcel is packed, cancelled before pickup, and tracked by polling, since
//! Sameday does not push status changes. Also keeps the easybox locker list
//! that checkout offers in sync.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use diesel::prelude::*;
use lettre::Address;
use uuid::Uuid;

use crate::AppState;
use crate::db;
use crate::enums::{DeliveryMethod, OrderStatus};
use crate::error::AppError;
use crate::language::Language;
use crate::mailer::{Action, Email, escape_html, html_layout};
use crate::metrics::{self, Task};
use crate::models::{CreateShipmentRequest, NewShipment, Order, SamedayLocker, Shipment};
use crate::sameday::{self, NewAwb, Recipient, SamedayClient, SamedayError};
use crate::schema::{order_items, orders, shipments};
use crate::shipping;

const LOCKER_SYNC_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);
const LOCKER_SYNC_RETRY: Duration = Duration::from_secs(60 * 60);
const TRACKING_INTERVAL: Duration = Duration::from_secs(30 * 60);
/// Shipments still undelivered after this long are no longer polled.
const TRACKING_MAX_AGE_DAYS: i64 = 30;
const MAX_PARCELS: i32 = 20;
const MAX_SHIPMENT_GRAMS: i32 = 1_000_000;

impl From<SamedayError> for AppError {
    fn from(e: SamedayError) -> Self {
        match e {
            SamedayError::Rejected(message) => AppError::Conflict(format!("Sameday: {message}")),
            SamedayError::Upstream(e) => {
                tracing::error!(error = %e, "Sameday request failed");
                AppError::ServiceUnavailable(
                    "Sameday is not answering; try again later".to_string(),
                )
            }
        }
    }
}

pub fn sameday_client(app_state: &AppState) -> Result<&SamedayClient, AppError> {
    app_state
        .sameday
        .as_deref()
        .ok_or_else(|| AppError::ServiceUnavailable("Sameday is not configured".to_string()))
}

/// Sum of `weight_grams × quantity` over the order's products, as they
/// weigh now: the admin form pre-fills it and may correct it.
pub fn order_weight_grams(conn: &mut PgConnection, order_id: Uuid) -> QueryResult<i64> {
    use crate::schema::products;
    order_items::table
        .inner_join(products::table)
        .filter(order_items::order_id.eq(order_id))
        .select((order_items::quantity, products::weight_grams))
        .load::<(i32, i32)>(conn)
        .map(|rows| {
            rows.iter()
                .map(|(q, w)| i64::from(*q) * i64::from(*w))
                .sum()
        })
}

fn products_cents(order: &Order) -> i64 {
    order.total_amount_cents - order.delivery.shipping_amount_cents
}

/// The waybill recipient: the Stripe address for home delivery, the locker's
/// address for easybox. Fails if the order lacks what Sameday needs.
fn recipient(order: &Order) -> Result<Recipient<'_>, AppError> {
    let d = &order.delivery;
    let missing = |what: &str| AppError::Conflict(format!("The order has no {what}"));
    let name = d
        .shipping_name
        .as_deref()
        .ok_or_else(|| missing("recipient name"))?;
    let phone = d
        .shipping_phone
        .as_deref()
        .ok_or_else(|| missing("phone number"))?;
    let email = order.customer_email.as_deref();
    Ok(match d.delivery_method {
        DeliveryMethod::Home => Recipient {
            name,
            phone,
            email,
            address: d
                .shipping_line1
                .as_deref()
                .ok_or_else(|| missing("delivery address"))?,
            city: d.shipping_city.as_deref().ok_or_else(|| missing("city"))?,
            county: d
                .shipping_state
                .as_deref()
                .ok_or_else(|| missing("county"))?,
            postal_code: d.shipping_postal_code.as_deref(),
        },
        DeliveryMethod::Easybox => Recipient {
            name,
            phone,
            email,
            address: d
                .locker_address
                .as_deref()
                .ok_or_else(|| missing("locker"))?,
            city: d.locker_city.as_deref().ok_or_else(|| missing("locker"))?,
            county: d
                .locker_county
                .as_deref()
                .ok_or_else(|| missing("locker"))?,
            postal_code: d.locker_postal_code.as_deref(),
        },
    })
}

/// A home-delivery address line two goes after the street for the courier.
fn home_address(order: &Order) -> Option<String> {
    let d = &order.delivery;
    d.shipping_line1
        .as_ref()
        .map(|line1| match &d.shipping_line2 {
            Some(line2) => format!("{line1}, {line2}"),
            None => line1.clone(),
        })
}

fn load_order(conn: &mut PgConnection, order_id: Uuid) -> Result<Order, AppError> {
    orders::table
        .find(order_id)
        .select(Order::as_select())
        .first(conn)
        .optional()?
        .ok_or_else(|| AppError::NotFound("Order not found".to_string()))
}

fn load_shipment(conn: &mut PgConnection, order_id: Uuid) -> QueryResult<Option<Shipment>> {
    shipments::table
        .find(order_id)
        .select(Shipment::as_select())
        .first(conn)
        .optional()
}

/// Creates the Sameday waybill of a paid order and emails the customer.
pub async fn create(
    app_state: &AppState,
    order_id: Uuid,
    request: &CreateShipmentRequest,
) -> Result<Shipment, AppError> {
    if !(1..=MAX_PARCELS).contains(&request.parcel_count)
        || !(1..=MAX_SHIPMENT_GRAMS).contains(&request.weight_grams)
    {
        return Err(AppError::BadRequest(
            "Parcel count or weight is out of range".to_string(),
        ));
    }
    let client = sameday_client(app_state)?;
    let order = {
        let mut conn = db::get_db_connection(app_state)?;
        let order = load_order(&mut conn, order_id)?;
        if order.status != OrderStatus::Paid || order.anonymized_at.is_some() {
            return Err(AppError::Conflict(
                "Only paid orders can be shipped".to_string(),
            ));
        }
        if load_shipment(&mut conn, order_id)?.is_some() {
            return Err(AppError::Conflict(
                "The order already has a waybill".to_string(),
            ));
        }
        order
    };

    // Sameday requires a new reference per AWB, also after a cancellation.
    let reference = format!("{order_id}-{}", Utc::now().timestamp());
    let mut recipient = recipient(&order)?;
    let full_address = home_address(&order);
    if order.delivery.delivery_method == DeliveryMethod::Home {
        recipient.address = full_address.as_deref().unwrap_or(recipient.address);
    }
    let locker_id = match order.delivery.delivery_method {
        DeliveryMethod::Home => None,
        DeliveryMethod::Easybox => {
            let mut conn = db::get_db_connection(app_state)?;
            Some(
                orders::table
                    .find(order_id)
                    .select(orders::locker_id)
                    .first::<Option<i32>>(&mut conn)?
                    .ok_or_else(|| AppError::Conflict("The order has no locker".to_string()))?,
            )
        }
    };
    let insured_value_cents = if request.insured {
        products_cents(&order)
    } else {
        0
    };
    let awb = NewAwb {
        ids: client.account_ids().await?,
        locker_id,
        recipient,
        parcel_count: request.parcel_count,
        weight_grams: request.weight_grams,
        insured_value_cents,
        reference: &reference,
    };
    let created = client.create_awb(&awb).await?;
    if !sameday::is_valid_awb_number(&created.awb_number) {
        return Err(SamedayError::Upstream("unexpected AWB number".to_string()).into());
    }

    let new = NewShipment {
        order_id,
        awb_number: created.awb_number.clone(),
        service_code: match locker_id {
            None => sameday::HOME_SERVICE_CODE,
            Some(_) => sameday::LOCKER_SERVICE_CODE,
        }
        .to_string(),
        parcel_count: request.parcel_count,
        weight_grams: request.weight_grams,
        insured_value_cents,
        cost_cents: created.awb_cost.map(|c| (c * 100.0).round() as i64),
    };
    let stored = db::get_db_connection(app_state).and_then(|mut conn| {
        diesel::insert_into(shipments::table)
            .values(&new)
            .returning(Shipment::as_returning())
            .get_result(&mut conn)
            .map_err(AppError::from)
    });
    let shipment = match stored {
        Ok(shipment) => shipment,
        Err(e) => {
            // Never leave a waybill at Sameday that the shop doesn't know of.
            if let Err(delete) = client.delete_awb(&created.awb_number).await {
                tracing::error!(error = %delete, %order_id, "orphaned Sameday AWB could not be cancelled");
            }
            return Err(e);
        }
    };

    send_shipped_email(app_state, &order, &created.awb_number);
    tracing::info!(%order_id, "Sameday AWB created");
    Ok(shipment)
}

/// Cancels the waybill at Sameday (only possible before pickup) and forgets it.
pub async fn cancel(app_state: &AppState, order_id: Uuid) -> Result<(), AppError> {
    let client = sameday_client(app_state)?;
    let shipment = {
        let mut conn = db::get_db_connection(app_state)?;
        load_shipment(&mut conn, order_id)?
    }
    .ok_or_else(|| AppError::NotFound("The order has no waybill".to_string()))?;
    if let Some(awb_number) = &shipment.tracking.awb_number {
        client.delete_awb(awb_number).await?;
    }
    let mut conn = db::get_db_connection(app_state)?;
    diesel::delete(shipments::table.find(order_id)).execute(&mut conn)?;
    tracing::info!(%order_id, "Sameday AWB cancelled");
    Ok(())
}

pub async fn label(app_state: &AppState, order_id: Uuid) -> Result<axum::body::Bytes, AppError> {
    let client = sameday_client(app_state)?;
    let awb_number = {
        let mut conn = db::get_db_connection(app_state)?;
        load_shipment(&mut conn, order_id)?
    }
    .and_then(|s| s.tracking.awb_number)
    .ok_or_else(|| AppError::NotFound("The order has no waybill".to_string()))?;
    Ok(client.label(&awb_number).await?)
}

/// `locker` is the easybox name for locker deliveries, `None` for home.
fn shipped_email(
    site_url: &str,
    lang: Language,
    to: Address,
    locker: Option<&str>,
    awb: &str,
) -> Email {
    let ro = lang == Language::Ro;
    let tracking_url = format!("{}{}", sameday::TRACKING_URL, awb);
    let where_to = match locker {
        Some(locker) => {
            if ro {
                format!("Coletul merge la easybox-ul „{locker}”. Vei primi de la Sameday codul de deschidere prin SMS și în aplicația lor.")
            } else {
                format!("The parcel is going to the “{locker}” easybox. Sameday will send you the code to open it by text message and in their app.")
            }
        }
        None => if ro {
            "Curierul Sameday te va suna înainte de livrare. Coletul conține alcool, așa că trebuie primit de o persoană de peste 18 ani."
        } else {
            "The Sameday courier will call you before delivery. The parcel contains alcohol, so it must be received by someone over 18."
        }
        .to_string(),
    };
    let paragraphs = [
        if ro {
            format!("Comanda ta a fost predată către Sameday. Numărul AWB este {awb}.")
        } else {
            format!("Your order has been handed to Sameday. The waybill (AWB) number is {awb}.")
        },
        where_to,
    ];
    let heading = if ro {
        "Comanda ta e pe drum"
    } else {
        "Your order is on its way"
    };
    let button = if ro {
        "Urmărește coletul"
    } else {
        "Track the parcel"
    };
    let orders_url = format!("{site_url}/{}/account", lang.code());
    let footer = if ro {
        format!("Dacă ai cont, găsești comanda și în {orders_url}.")
    } else {
        format!("If you have an account, the order is also in {orders_url}.")
    };
    let text = std::iter::once(heading.to_string())
        .chain(paragraphs.iter().cloned())
        .chain([format!("{button}: {tracking_url}"), footer.clone()])
        .collect::<Vec<_>>()
        .join("\n\n");
    let escaped: Vec<String> = paragraphs.iter().map(|p| escape_html(p)).collect();
    Email {
        to,
        subject: heading.to_string(),
        text: text + "\n",
        html: html_layout(
            lang,
            heading,
            &escaped,
            Some(&Action {
                label: button,
                url: &tracking_url,
            }),
            &escape_html(&footer),
        ),
        list_unsubscribe: None,
    }
}

fn send_shipped_email(app_state: &AppState, order: &Order, awb: &str) {
    let Some(to) = order
        .customer_email
        .as_deref()
        .and_then(|e| e.parse::<Address>().ok())
    else {
        return;
    };
    let lang = Language::from_code(&order.language);
    let locker = match order.delivery.delivery_method {
        DeliveryMethod::Home => None,
        DeliveryMethod::Easybox => order.delivery.locker_name.as_deref(),
    };
    app_state
        .mailer
        .send_in_background(shipped_email(&app_state.site_url, lang, to, locker, awb));
}

/// Keeps `sameday_lockers` and the account's service ids current: on
/// startup, then daily (hourly while failing).
pub async fn run_locker_sync(app_state: Arc<AppState>) {
    let Some(client) = app_state.sameday.clone() else {
        return;
    };
    loop {
        let delay = match sync_lockers(&app_state, &client).await {
            Ok(count) => {
                tracing::info!(count, "Sameday lockers synced");
                LOCKER_SYNC_INTERVAL
            }
            Err(e) => {
                tracing::warn!(error = %e, "Sameday locker sync failed");
                metrics::record_failure(Task::sameday_lockers);
                LOCKER_SYNC_RETRY
            }
        };
        tokio::time::sleep(delay).await;
    }
}

async fn sync_lockers(app_state: &AppState, client: &SamedayClient) -> Result<usize, String> {
    client
        .refresh_account_ids()
        .await
        .map_err(|e| e.to_string())?;
    let now = Utc::now();
    let lockers: Vec<SamedayLocker> = client
        .lockers()
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|l| SamedayLocker {
            locker_id: l.locker_id,
            name: truncate(&l.name, 255),
            county: truncate(&l.county, 255),
            city: truncate(&l.city, 255),
            address: truncate(&l.address, 512),
            postal_code: truncate(l.postal_code.as_deref().unwrap_or_default(), 32),
            synced_at: now,
        })
        .collect();
    // An empty answer is far likelier an upstream glitch than every locker
    // closing; keep the old list rather than switching easybox off.
    if lockers.is_empty() {
        return Err("Sameday returned no lockers".to_string());
    }
    let count = lockers.len();
    let mut conn = db::get_db_connection(app_state).map_err(|e| format!("{e:?}"))?;
    shipping::replace_lockers(&mut conn, &lockers).map_err(|e| e.to_string())?;
    Ok(count)
}

fn truncate(value: &str, max: usize) -> String {
    value.trim().chars().take(max).collect()
}

/// Refreshes the status of undelivered shipments every 30 minutes.
pub async fn run_tracking_sync(app_state: Arc<AppState>) {
    let Some(client) = app_state.sameday.clone() else {
        return;
    };
    let mut interval = tokio::time::interval(TRACKING_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        if let Err(e) = sync_tracking(&app_state, &client).await {
            tracing::warn!(error = %e, "Sameday tracking sync failed");
            metrics::record_failure(Task::sameday_tracking);
        }
    }
}

async fn sync_tracking(app_state: &AppState, client: &SamedayClient) -> Result<(), String> {
    let since = Utc::now() - chrono::Duration::days(TRACKING_MAX_AGE_DAYS);
    let pending: Vec<(Uuid, Option<String>)> = {
        let mut conn = db::get_db_connection(app_state).map_err(|e| format!("{e:?}"))?;
        shipments::table
            .filter(shipments::delivered_at.is_null())
            .filter(shipments::canceled.eq(false))
            .filter(shipments::awb_number.is_not_null())
            .filter(shipments::created_at.gt(since))
            .select((shipments::order_id, shipments::awb_number))
            .load(&mut conn)
            .map_err(|e| e.to_string())?
    };
    let mut failures = 0;
    for (order_id, awb_number) in pending {
        let Some(awb_number) = awb_number else {
            continue;
        };
        let status = match client.awb_status(&awb_number).await {
            Ok(status) => status,
            Err(e) => {
                tracing::warn!(error = %e, %order_id, "Sameday status lookup failed");
                failures += 1;
                continue;
            }
        };
        let summary = &status.expedition_summary;
        let delivered_at = summary
            .delivered
            .then(|| {
                summary
                    .delivered_at
                    .as_deref()
                    .and_then(sameday::parse_time)
            })
            .flatten()
            .or_else(|| summary.delivered.then(Utc::now));
        let mut conn = db::get_db_connection(app_state).map_err(|e| format!("{e:?}"))?;
        diesel::update(shipments::table.find(order_id))
            .set((
                shipments::status_label.eq(truncate(&status.expedition_status.status_label, 255)),
                shipments::status_at.eq(sameday::parse_time(&status.expedition_status.status_date)),
                shipments::delivered_at.eq(delivered_at),
                shipments::canceled.eq(summary.canceled),
            ))
            .execute(&mut conn)
            .map_err(|e| e.to_string())?;
    }
    if failures > 0 {
        return Err(format!("{failures} status lookups failed"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn to() -> Address {
        "ana@example.ro".parse().unwrap()
    }

    #[test]
    fn shipped_email_names_the_locker_and_links_tracking() {
        let email = shipped_email(
            "https://shop.test",
            Language::En,
            to(),
            Some("easybox <Grozăvești>"),
            "1ONB24123456789",
        );
        assert!(email.text.contains("“easybox <Grozăvești>” easybox"));
        assert!(email.html.contains("easybox &lt;Grozăvești&gt;"));
        assert!(
            email
                .text
                .contains("https://sameday.ro/#awb=1ONB24123456789")
        );
        assert!(email.text.contains("https://shop.test/en/account"));
    }

    #[test]
    fn shipped_email_home_delivery_mentions_age() {
        let email = shipped_email(
            "https://shop.test",
            Language::Ro,
            to(),
            None,
            "1ONB24123456789",
        );
        assert!(email.text.contains("peste 18 ani"));
        assert_eq!(email.subject, "Comanda ta e pe drum");
    }
}
