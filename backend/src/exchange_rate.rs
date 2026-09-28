//! Official BNR (National Bank of Romania) EUR reference rate, used to show
//! indicative EUR prices on the English site. Prices are always entered and
//! charged in RON; the rate never affects what a customer pays.

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Days, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Europe::Bucharest;
use diesel::prelude::*;
use quick_xml::Reader;
use quick_xml::events::Event;
use rust_decimal::Decimal;
use serde::Serialize;
use ts_rs::TS;

use crate::AppState;
use crate::db;
use crate::schema::exchange_rates;

const BNR_RATES_URL: &str = "https://curs.bnr.ro/nbrfxrates.xml";
const EUR: &str = "EUR";
/// The daily feed is ~3 KB; anything far larger is not the feed.
const MAX_FEED_BYTES: usize = 256 * 1024;
const FETCH_TIMEOUT: Duration = Duration::from_secs(20);
const RETRY_DELAY: Duration = Duration::from_secs(15 * 60);
/// BNR publishes shortly after 13:00 Bucharest time on business days.
const DAILY_REFRESH_TIME: NaiveTime = NaiveTime::from_hms_opt(13, 10, 0).unwrap();
/// Sanity bounds on RON per EUR (the rate has sat around 4.4–5.3 for the past
/// decade), so a malformed or tampered feed can never produce absurd prices.
const MIN_PLAUSIBLE_RATE: Decimal = Decimal::from_parts(3, 0, 0, false, 0);
const MAX_PLAUSIBLE_RATE: Decimal = Decimal::from_parts(10, 0, 0, false, 0);

/// RON per one EUR, as published by BNR for `rate_date`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EurRate {
    pub rate: Decimal,
    pub rate_date: NaiveDate,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct ExchangeRateInfo {
    /// RON per one EUR.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub rate: Decimal,
    pub rate_date: NaiveDate,
}

impl From<EurRate> for ExchangeRateInfo {
    fn from(r: EurRate) -> Self {
        ExchangeRateInfo {
            rate: r.rate,
            rate_date: r.rate_date,
        }
    }
}

#[derive(Debug)]
pub enum RateError {
    Fetch(reqwest::Error),
    FeedTooLarge,
    Parse(String),
    Implausible(EurRate),
    Database(diesel::result::Error),
    Pool(crate::AppError),
}

pub fn latest_eur_rate(conn: &mut PgConnection) -> QueryResult<Option<EurRate>> {
    exchange_rates::table
        .filter(exchange_rates::currency.eq(EUR))
        .order(exchange_rates::rate_date.desc())
        .select((exchange_rates::rate, exchange_rates::rate_date))
        .first::<(Decimal, NaiveDate)>(conn)
        .optional()
        .map(|row| row.map(|(rate, rate_date)| EurRate { rate, rate_date }))
}

fn store_eur_rate(conn: &mut PgConnection, rate: EurRate) -> QueryResult<()> {
    diesel::insert_into(exchange_rates::table)
        .values((
            exchange_rates::currency.eq(EUR),
            exchange_rates::rate_date.eq(rate.rate_date),
            exchange_rates::rate.eq(rate.rate),
        ))
        .on_conflict((exchange_rates::currency, exchange_rates::rate_date))
        .do_update()
        .set((
            exchange_rates::rate.eq(rate.rate),
            exchange_rates::fetched_at.eq(diesel::dsl::now),
        ))
        .execute(conn)
        .map(|_| ())
}

/// Extracts the EUR rate and its date from the BNR `nbrfxrates.xml` feed.
fn parse_eur_rate(xml: &str) -> Result<EurRate, RateError> {
    let parse_err = |e: &dyn std::fmt::Display| RateError::Parse(e.to_string());
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut cube_date: Option<NaiveDate> = None;
    let mut in_eur_rate = false;
    loop {
        match reader.read_event().map_err(|e| parse_err(&e))? {
            Event::Start(e) => match e.local_name().as_ref() {
                b"Cube" => {
                    let date = e
                        .try_get_attribute("date")
                        .map_err(|e| parse_err(&e))?
                        .ok_or_else(|| RateError::Parse("Cube without date".to_string()))?
                        .unescape_value()
                        .map_err(|e| parse_err(&e))?;
                    cube_date = Some(date.parse().map_err(|e| parse_err(&e))?);
                }
                b"Rate" => {
                    let currency = e.try_get_attribute("currency").map_err(|e| parse_err(&e))?;
                    let multiplier = e
                        .try_get_attribute("multiplier")
                        .map_err(|e| parse_err(&e))?;
                    in_eur_rate = currency.is_some_and(|c| c.value.as_ref() == EUR.as_bytes())
                        && multiplier.is_none_or(|m| m.value.as_ref() == b"1");
                }
                _ => {}
            },
            Event::Text(text) if in_eur_rate => {
                let rate_date = cube_date
                    .ok_or_else(|| RateError::Parse("EUR rate outside a dated Cube".to_string()))?;
                let rate = text
                    .unescape()
                    .map_err(|e| parse_err(&e))?
                    .parse::<Decimal>()
                    .map_err(|e| parse_err(&e))?;
                return Ok(EurRate { rate, rate_date });
            }
            Event::End(_) => in_eur_rate = false,
            Event::Eof => return Err(RateError::Parse("no EUR rate in feed".to_string())),
            _ => {}
        }
    }
}

/// Rejects rates outside plausible bounds or dated in the future.
fn validate(rate: EurRate, today: NaiveDate) -> Result<EurRate, RateError> {
    let plausible =
        (MIN_PLAUSIBLE_RATE..=MAX_PLAUSIBLE_RATE).contains(&rate.rate) && rate.rate_date <= today;
    if plausible {
        Ok(rate)
    } else {
        Err(RateError::Implausible(rate))
    }
}

async fn fetch_feed(client: &reqwest::Client) -> Result<String, RateError> {
    let mut response = client
        .get(BNR_RATES_URL)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(RateError::Fetch)?;
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(RateError::Fetch)? {
        if body.len() + chunk.len() > MAX_FEED_BYTES {
            return Err(RateError::FeedTooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    String::from_utf8(body).map_err(|e| RateError::Parse(e.to_string()))
}

async fn refresh(
    app_state: &Arc<AppState>,
    client: &reqwest::Client,
) -> Result<EurRate, RateError> {
    let xml = fetch_feed(client).await?;
    let today = Utc::now().with_timezone(&Bucharest).date_naive();
    let rate = validate(parse_eur_rate(&xml)?, today)?;

    let mut conn = db::get_db_connection(app_state).map_err(RateError::Pool)?;
    store_eur_rate(&mut conn, rate).map_err(RateError::Database)?;
    if app_state
        .current_eur_rate()
        .is_none_or(|cached| cached.rate_date <= rate.rate_date)
    {
        app_state.set_eur_rate(rate);
    }
    Ok(rate)
}

/// Next daily refresh after `now`: today's 13:10 Bucharest time if still
/// ahead, otherwise tomorrow's.
fn next_refresh_after(now: DateTime<Utc>) -> DateTime<Utc> {
    let local_today = now.with_timezone(&Bucharest).date_naive();
    [local_today, local_today + Days::new(1)]
        .into_iter()
        .filter_map(|day| {
            Bucharest
                .from_local_datetime(&day.and_time(DAILY_REFRESH_TIME))
                .earliest()
        })
        .map(|t| t.with_timezone(&Utc))
        .find(|t| *t > now)
        .unwrap_or(now + chrono::Duration::days(1))
}

/// Fetches the BNR rate on startup and then daily after publication,
/// retrying every 15 minutes on failure. The last good rate keeps being
/// served (and stays in the database) while fetching fails.
pub async fn run_refresh_task(app_state: Arc<AppState>) {
    let client = match reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .user_agent("miedaria-paunilor-backend")
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            tracing::error!(error = %e, "cannot build HTTP client; BNR rate refresh disabled");
            return;
        }
    };

    loop {
        let delay = match refresh(&app_state, &client).await {
            Ok(rate) => {
                tracing::info!(rate = %rate.rate, rate_date = %rate.rate_date, "BNR EUR rate refreshed");
                let now = Utc::now();
                (next_refresh_after(now) - now)
                    .to_std()
                    .unwrap_or(RETRY_DELAY)
            }
            Err(e) => {
                tracing::warn!(error = ?e, "BNR EUR rate refresh failed; serving last known rate");
                RETRY_DELAY
            }
        };
        tokio::time::sleep(delay).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    const FEED: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="https://www.bnr.ro/xsd"><Header><PublishingDate>2026-09-25</PublishingDate></Header>
<Body><OrigCurrency>RON</OrigCurrency><Cube date="2026-09-25">
<Rate currency="CHF">5.5798</Rate><Rate currency="EUR">5.2718</Rate>
<Rate currency="HUF" multiplier="100">1.4455</Rate></Cube></Body></DataSet>"#;

    fn date(s: &str) -> NaiveDate {
        s.parse().unwrap()
    }

    #[test]
    fn parses_eur_rate_and_date() {
        let rate = parse_eur_rate(FEED).unwrap();
        assert_eq!(rate.rate, Decimal::from_str("5.2718").unwrap());
        assert_eq!(rate.rate_date, date("2026-09-25"));
    }

    #[test]
    fn rejects_feed_without_eur() {
        let feed = FEED.replace(r#"<Rate currency="EUR">5.2718</Rate>"#, "");
        assert!(parse_eur_rate(&feed).is_err());
    }

    #[test]
    fn ignores_eur_rate_with_multiplier() {
        let feed = FEED.replace(r#"currency="EUR""#, r#"currency="EUR" multiplier="100""#);
        assert!(parse_eur_rate(&feed).is_err());
    }

    #[test]
    fn validates_plausibility_and_date() {
        let today = date("2026-09-26");
        let ok = EurRate {
            rate: Decimal::from_str("5.2718").unwrap(),
            rate_date: date("2026-09-25"),
        };
        assert!(validate(ok, today).is_ok());
        assert!(
            validate(
                EurRate {
                    rate: Decimal::from_str("0.19").unwrap(),
                    ..ok
                },
                today
            )
            .is_err()
        );
        assert!(
            validate(
                EurRate {
                    rate: Decimal::from(52),
                    ..ok
                },
                today
            )
            .is_err()
        );
        assert!(
            validate(
                EurRate {
                    rate_date: date("2026-09-27"),
                    ..ok
                },
                today
            )
            .is_err()
        );
    }

    #[test]
    fn schedules_next_refresh_at_1310_bucharest() {
        // 09:00 UTC = 12:00 EEST: refresh later the same day at 13:10 local.
        let morning = Utc.with_ymd_and_hms(2026, 9, 25, 9, 0, 0).unwrap();
        assert_eq!(
            next_refresh_after(morning),
            Utc.with_ymd_and_hms(2026, 9, 25, 10, 10, 0).unwrap()
        );
        // Past 13:10 local: refresh tomorrow.
        let afternoon = Utc.with_ymd_and_hms(2026, 9, 25, 12, 0, 0).unwrap();
        assert_eq!(
            next_refresh_after(afternoon),
            Utc.with_ymd_and_hms(2026, 9, 26, 10, 10, 0).unwrap()
        );
    }
}
