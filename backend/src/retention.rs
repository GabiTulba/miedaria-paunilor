//! Storage limitation (GDPR art. 5(1)(e)) for orders. Once an order is no
//! longer needed, its personal data is erased and only an anonymous record
//! (amounts, products, dates) remains. That record keeps the accounting
//! totals and the sales metrics intact, and it is no longer personal data.
//!
//! - Paid orders are accounting records. Legea contabilității nr. 82/1991
//!   requires keeping them for 5 years from the end of the financial year
//!   (the calendar year), so an order from 2026 is erased in January 2032.
//! - Orders that were never paid are not accounting records. A failed delayed
//!   payment still holds the contact details Stripe returned, so those are
//!   erased 90 days after the order ended, which leaves time for
//!   customer-service questions.

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};
use chrono_tz::Europe::Bucharest;

use crate::AppState;
use crate::db;
use crate::metrics::{self, Task};
use crate::order_crud;

/// Years a paid order is kept after the end of the financial year it belongs to.
pub const ACCOUNTING_RETENTION_YEARS: i32 = 5;
/// How long an unpaid order's contact details are kept after it ended.
pub const UNPAID_RETENTION: chrono::Duration = chrono::Duration::days(90);
const RUN_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

/// Paid orders created before this instant are past their retention period:
/// the start (Bucharest time) of the year `ACCOUNTING_RETENTION_YEARS` before
/// the current one.
pub fn accounting_cutoff(now: DateTime<Utc>) -> DateTime<Utc> {
    let year = now.with_timezone(&Bucharest).year() - ACCOUNTING_RETENTION_YEARS;
    let midnight = NaiveDate::from_ymd_opt(year, 1, 1)
        .expect("January 1st exists")
        .and_hms_opt(0, 0, 0)
        .expect("midnight exists");
    Bucharest
        .from_local_datetime(&midnight)
        .single()
        .expect("New Year's midnight is unambiguous in Bucharest")
        .with_timezone(&Utc)
}

/// Erases the personal data of every order past its retention period, on
/// startup and then daily.
pub async fn run_retention_task(app_state: Arc<AppState>) {
    let mut interval = tokio::time::interval(RUN_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        let now = Utc::now();
        let result = tokio::task::spawn_blocking({
            let app_state = app_state.clone();
            move || {
                let mut conn = db::get_db_connection(&app_state)?;
                order_crud::anonymize_expired(
                    &mut conn,
                    accounting_cutoff(now),
                    now - UNPAID_RETENTION,
                )
                .map_err(crate::AppError::from)
            }
        })
        .await;
        match result {
            Ok(Ok(0)) => {}
            Ok(Ok(erased)) => {
                tracing::info!(erased, "erased personal data of orders past retention")
            }
            Ok(Err(e)) => {
                tracing::error!(error = ?e, "order retention run failed");
                metrics::record_failure(Task::order_retention);
            }
            Err(e) => {
                tracing::error!(error = %e, "order retention task panicked");
                metrics::record_failure(Task::order_retention);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(s: &str) -> DateTime<Utc> {
        s.parse().unwrap()
    }

    #[test]
    fn order_is_kept_five_years_after_its_financial_year() {
        // During 2031 the 2026 financial year is still within retention.
        let cutoff = accounting_cutoff(utc("2031-12-31T12:00:00Z"));
        assert_eq!(cutoff, utc("2025-12-31T22:00:00Z")); // 2026-01-01 00:00 Bucharest (UTC+2)
        assert!(utc("2026-06-15T10:00:00Z") >= cutoff);
        assert!(utc("2025-12-31T21:59:59Z") < cutoff);

        // From January 2032 the 2026 orders are due.
        let cutoff = accounting_cutoff(utc("2032-01-01T10:00:00Z"));
        assert!(utc("2026-12-31T21:00:00Z") < cutoff);
        assert!(utc("2027-01-01T10:00:00Z") >= cutoff);
    }

    #[test]
    fn year_boundary_follows_bucharest_time() {
        // 22:30 UTC on Dec 31 is already New Year in Bucharest.
        assert_eq!(
            accounting_cutoff(utc("2031-12-31T22:30:00Z")),
            accounting_cutoff(utc("2032-06-01T00:00:00Z"))
        );
    }
}
