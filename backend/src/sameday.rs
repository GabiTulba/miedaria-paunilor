//! Client for Sameday Courier's REST API (the same API the official PHP SDK
//! wraps): easybox lockers, waybills (AWBs), labels and parcel statuses.
//! Requests are form-encoded in PHP bracket style (`awbRecipient[name]=…`);
//! responses are JSON. Service and pickup-point ids differ between Sameday's
//! demo and production environments, so they are looked up, never hard-coded.

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Europe::Bucharest;
use reqwest::{Method, StatusCode};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use tokio::sync::Mutex;

const HTTP_TIMEOUT: Duration = Duration::from_secs(20);
const PAGE_SIZE: u32 = 500;
/// Home delivery, next working day.
pub const HOME_SERVICE_CODE: &str = "24";
/// easybox locker, next working day.
pub const LOCKER_SERVICE_CODE: &str = "LN";
/// Public tracking page; the AWB is filled in by the page itself.
pub const TRACKING_URL: &str = "https://sameday.ro/#awb=";

#[derive(Clone)]
pub struct SamedayConfig {
    pub api_url: String,
    pub username: String,
    pub password: String,
    /// Identifies this site to Sameday's easybox map widget; without it
    /// easybox is not offered.
    pub locker_client_id: Option<String>,
}

pub type SharedSamedayClient = Option<Arc<SamedayClient>>;

pub struct SamedayClient {
    config: SamedayConfig,
    http: reqwest::Client,
    token: Mutex<Option<Token>>,
    ids: std::sync::RwLock<Option<AccountIds>>,
}

struct Token {
    value: String,
    expires_at: DateTime<Utc>,
}

#[derive(Debug)]
pub enum SamedayError {
    /// Sameday refused the request; the message is Sameday's own and safe to
    /// show an admin.
    Rejected(String),
    Upstream(String),
}

impl std::fmt::Display for SamedayError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SamedayError::Rejected(m) => write!(f, "rejected: {m}"),
            SamedayError::Upstream(m) => write!(f, "upstream: {m}"),
        }
    }
}

fn upstream(e: impl std::fmt::Display) -> SamedayError {
    SamedayError::Upstream(e.to_string())
}

/// A form body in PHP's `http_build_query` layout, which Sameday parses.
#[derive(Default)]
pub struct Form(Vec<(String, String)>);

impl Form {
    pub fn field(mut self, key: impl Into<String>, value: impl ToString) -> Self {
        self.0.push((key.into(), value.to_string()));
        self
    }

    pub fn optional(self, key: &str, value: Option<impl ToString>) -> Self {
        match value {
            Some(v) => self.field(key, v),
            None => self,
        }
    }

    fn encode(&self) -> String {
        let mut out = reqwest::Url::parse("http://form.invalid/").expect("static URL parses");
        out.query_pairs_mut().extend_pairs(&self.0);
        out.query().unwrap_or_default().to_string()
    }
}

#[derive(Deserialize)]
struct Page<T> {
    data: Vec<T>,
    #[serde(default)]
    pages: u32,
}

/// The one snake_case response of the API.
#[derive(Deserialize)]
struct AuthResponse {
    token: String,
    expire_at_utc: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: i64,
    pub service_code: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupPoint {
    pub id: i64,
    #[serde(default)]
    pub default_pickup_point: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Locker {
    pub locker_id: i32,
    pub name: String,
    pub county: String,
    pub city: String,
    pub address: String,
    #[serde(default)]
    pub postal_code: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedAwb {
    pub awb_number: String,
    pub awb_cost: Option<f64>,
}

/// Where a whole shipment stands.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwbStatus {
    pub expedition_summary: ExpeditionSummary,
    pub expedition_status: ExpeditionStatus,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpeditionSummary {
    #[serde(default)]
    pub delivered: bool,
    #[serde(default)]
    pub canceled: bool,
    /// Bucharest local time.
    pub delivered_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpeditionStatus {
    pub status_label: String,
    /// Bucharest local time.
    pub status_date: String,
}

/// Ids resolved from the account's services and pickup points.
#[derive(Clone, Copy, Debug)]
pub struct AccountIds {
    pub pickup_point: i64,
    pub home_service: i64,
    pub locker_service: Option<i64>,
}

/// Recipient of a waybill: for easybox, the customer's name and phone with
/// the locker's own address.
pub struct Recipient<'a> {
    pub name: &'a str,
    pub phone: &'a str,
    pub email: Option<&'a str>,
    pub address: &'a str,
    pub city: &'a str,
    pub county: &'a str,
    pub postal_code: Option<&'a str>,
}

pub struct NewAwb<'a> {
    pub ids: AccountIds,
    pub locker_id: Option<i32>,
    pub recipient: Recipient<'a>,
    pub parcel_count: i32,
    pub weight_grams: i32,
    pub insured_value_cents: i64,
    pub reference: &'a str,
}

impl NewAwb<'_> {
    pub fn service_id(&self) -> Result<i64, SamedayError> {
        match self.locker_id {
            None => Ok(self.ids.home_service),
            Some(_) => self.ids.locker_service.ok_or_else(|| {
                SamedayError::Rejected(
                    "The easybox service is not active on this Sameday account".to_string(),
                )
            }),
        }
    }

    pub fn form(&self) -> Result<Form, SamedayError> {
        let kg = f64::from(self.weight_grams) / 1000.0;
        let per_parcel = kg / f64::from(self.parcel_count);
        let r = &self.recipient;
        let mut form = Form::default()
            .field("pickupPoint", self.ids.pickup_point)
            .field("packageType", package_type(per_parcel))
            .field("packageNumber", self.parcel_count)
            .field("packageWeight", format!("{kg:.3}"))
            .field("service", self.service_id()?)
            .field("awbPayment", 1)
            .field("cashOnDelivery", 0)
            .field(
                "insuredValue",
                format!("{:.2}", self.insured_value_cents as f64 / 100.0),
            )
            .field("thirdPartyPickup", 0)
            .field("awbRecipient[name]", r.name)
            .field("awbRecipient[phoneNumber]", r.phone)
            .field("awbRecipient[personType]", 0)
            .field("awbRecipient[address]", r.address)
            .field("awbRecipient[cityString]", r.city)
            .field("awbRecipient[countyString]", r.county)
            .optional("awbRecipient[postalCode]", r.postal_code)
            .optional("awbRecipient[email]", r.email)
            .field("clientInternalReference", self.reference)
            .optional("oohLastMile", self.locker_id);
        for i in 0..self.parcel_count {
            form = form.field(format!("parcels[{i}][weight]"), format!("{per_parcel:.3}"));
        }
        Ok(form)
    }
}

/// Sameday's parcel classes: small up to 1 kg, standard up to 38 kg, and
/// overweight above that.
fn package_type(parcel_kg: f64) -> u8 {
    match parcel_kg {
        kg if kg <= 1.0 => 1,
        kg if kg <= 38.0 => 0,
        _ => 2,
    }
}

/// Sameday's statuses carry an offset (`2019-02-26T09:37:28+0200`); other
/// times are Bucharest local time without one.
pub fn parse_time(value: &str) -> Option<DateTime<Utc>> {
    ["%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S%:z"]
        .iter()
        .find_map(|f| DateTime::parse_from_str(value, f).ok())
        .map(|t| t.with_timezone(&Utc))
        .or_else(|| {
            ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"]
                .iter()
                .find_map(|f| NaiveDateTime::parse_from_str(value, f).ok())
                .and_then(|t| Bucharest.from_local_datetime(&t).earliest())
                .map(|t| t.with_timezone(&Utc))
        })
}

/// Sameday's validation errors nest under `errors.children.<field>.errors`.
fn rejection_message(body: &str) -> String {
    fn collect(value: &serde_json::Value, path: &str, out: &mut Vec<String>) {
        if let Some(errors) = value.get("errors") {
            if let Some(list) = errors.as_array() {
                for e in list.iter().filter_map(|e| e.as_str()) {
                    out.push(if path.is_empty() {
                        e.to_string()
                    } else {
                        format!("{path}: {e}")
                    });
                }
            } else {
                collect(errors, path, out);
            }
        }
        if let Some(children) = value.get("children").and_then(|c| c.as_object()) {
            for (key, child) in children {
                let child_path = if path.is_empty() {
                    key.clone()
                } else {
                    format!("{path}.{key}")
                };
                collect(child, &child_path, out);
            }
        }
    }
    let Ok(json) = serde_json::from_str::<serde_json::Value>(body) else {
        return "Sameday rejected the request".to_string();
    };
    let mut messages = Vec::new();
    collect(&json, "", &mut messages);
    if messages.is_empty() {
        json.get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Sameday rejected the request")
            .to_string()
    } else {
        messages.join("; ")
    }
}

impl SamedayClient {
    pub fn new(config: SamedayConfig) -> Result<Self, String> {
        let http = reqwest::Client::builder()
            .timeout(HTTP_TIMEOUT)
            .user_agent("miedaria-paunilor-backend")
            .build()
            .map_err(|e| format!("cannot build HTTP client for Sameday: {e}"))?;
        Ok(Self {
            config,
            http,
            token: Mutex::new(None),
            ids: std::sync::RwLock::new(None),
        })
    }

    pub fn api_username(&self) -> &str {
        &self.config.username
    }

    pub fn locker_client_id(&self) -> Option<&str> {
        self.config.locker_client_id.as_deref()
    }

    /// easybox needs the locker map to choose a locker.
    pub fn offers_easybox(&self) -> bool {
        self.config.locker_client_id.is_some()
    }

    async fn token(&self, renew: bool) -> Result<String, SamedayError> {
        let mut token = self.token.lock().await;
        if !renew && let Some(t) = token.as_ref().filter(|t| t.expires_at > Utc::now()) {
            return Ok(t.value.clone());
        }
        let response = self
            .http
            .post(format!("{}/api/authenticate", self.config.api_url))
            .header("X-AUTH-USERNAME", &self.config.username)
            .header("X-AUTH-PASSWORD", &self.config.password)
            .header(
                reqwest::header::CONTENT_TYPE,
                "application/x-www-form-urlencoded",
            )
            .body("remember_me=1")
            .send()
            .await
            .map_err(upstream)?;
        if !response.status().is_success() {
            return Err(SamedayError::Upstream(format!(
                "authentication failed with {}",
                response.status()
            )));
        }
        let auth: AuthResponse = response.json().await.map_err(upstream)?;
        // Renew an hour early so a token never expires mid-request.
        let expires_at = NaiveDateTime::parse_from_str(&auth.expire_at_utc, "%Y-%m-%d %H:%M")
            .map(|t| t.and_utc())
            .unwrap_or_else(|_| Utc::now() + chrono::Duration::hours(12))
            - chrono::Duration::hours(1);
        *token = Some(Token {
            value: auth.token.clone(),
            expires_at,
        });
        Ok(auth.token)
    }

    /// Sends an authenticated request, logging in again once if Sameday
    /// no longer accepts the cached token.
    async fn send(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        form: Option<&Form>,
    ) -> Result<reqwest::Response, SamedayError> {
        let mut renew = false;
        loop {
            let mut request = self
                .http
                .request(method.clone(), format!("{}{}", self.config.api_url, path))
                .header("X-AUTH-TOKEN", self.token(renew).await?)
                .query(query);
            if let Some(form) = form {
                request = request
                    .header(
                        reqwest::header::CONTENT_TYPE,
                        "application/x-www-form-urlencoded",
                    )
                    .body(form.encode());
            }
            let response = request.send().await.map_err(upstream)?;
            let status = response.status();
            if matches!(status, StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN) && !renew {
                renew = true;
                continue;
            }
            if status.is_success() {
                return Ok(response);
            }
            let body = response.text().await.unwrap_or_default();
            return Err(if status.is_client_error() {
                SamedayError::Rejected(rejection_message(&body))
            } else {
                SamedayError::Upstream(format!("{path} answered {status}"))
            });
        }
    }

    async fn json<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        form: Option<&Form>,
    ) -> Result<T, SamedayError> {
        self.send(method, path, query, form)
            .await?
            .json()
            .await
            .map_err(upstream)
    }

    async fn all_pages<T: DeserializeOwned>(
        &self,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<Vec<T>, SamedayError> {
        let mut items = Vec::new();
        let mut page = 1;
        loop {
            let mut params = query.to_vec();
            params.push(("page", page.to_string()));
            params.push(("countPerPage", PAGE_SIZE.to_string()));
            let batch: Page<T> = self.json(Method::GET, path, &params, None).await?;
            items.extend(batch.data);
            if page >= batch.pages {
                return Ok(items);
            }
            page += 1;
        }
    }

    /// The account's ids, looked up on first use and by each locker sync.
    pub async fn account_ids(&self) -> Result<AccountIds, SamedayError> {
        let cached = *self.ids.read().unwrap_or_else(|e| e.into_inner());
        match cached {
            Some(ids) => Ok(ids),
            None => self.refresh_account_ids().await,
        }
    }

    /// Looks up the default pickup point and the home and easybox services.
    pub async fn refresh_account_ids(&self) -> Result<AccountIds, SamedayError> {
        let services: Vec<Service> = self.all_pages("/api/client/services", &[]).await?;
        let points: Vec<PickupPoint> = self.all_pages("/api/client/pickup-points", &[]).await?;
        let service = |code: &str| {
            services
                .iter()
                .find(|s| s.service_code == code)
                .map(|s| s.id)
        };
        let pickup_point = points
            .iter()
            .find(|p| p.default_pickup_point)
            .or(points.first())
            .map(|p| p.id)
            .ok_or_else(|| upstream("the Sameday account has no pickup point"))?;
        let home_service = service(HOME_SERVICE_CODE)
            .ok_or_else(|| upstream("the Sameday account has no 24H home delivery service"))?;
        let ids = AccountIds {
            pickup_point,
            home_service,
            locker_service: service(LOCKER_SERVICE_CODE),
        };
        *self.ids.write().unwrap_or_else(|e| e.into_inner()) = Some(ids);
        Ok(ids)
    }

    pub async fn lockers(&self) -> Result<Vec<Locker>, SamedayError> {
        self.all_pages("/api/client/lockers", &[]).await
    }

    pub async fn create_awb(&self, awb: &NewAwb<'_>) -> Result<CreatedAwb, SamedayError> {
        self.json(Method::POST, "/api/awb", &[], Some(&awb.form()?))
            .await
    }

    pub async fn delete_awb(&self, awb_number: &str) -> Result<(), SamedayError> {
        self.send(
            Method::DELETE,
            &format!("/api/awb/{}", path_segment(awb_number)),
            &[],
            None,
        )
        .await
        .map(drop)
    }

    /// The A6 label of an AWB, as a PDF.
    pub async fn label(&self, awb_number: &str) -> Result<axum::body::Bytes, SamedayError> {
        let path = format!("/api/awb/download/{}/A6", path_segment(awb_number));
        self.send(Method::GET, &path, &[], None)
            .await?
            .bytes()
            .await
            .map_err(upstream)
    }

    pub async fn awb_status(&self, awb_number: &str) -> Result<AwbStatus, SamedayError> {
        let path = format!("/api/client/awb/{}/status", path_segment(awb_number));
        self.json(Method::GET, &path, &[], None).await
    }
}

/// AWB numbers are alphanumeric; anything else is rejected before it can
/// reach a URL path.
fn path_segment(awb_number: &str) -> &str {
    if is_valid_awb_number(awb_number) {
        awb_number
    } else {
        "invalid"
    }
}

pub fn is_valid_awb_number(awb_number: &str) -> bool {
    (5..=64).contains(&awb_number.len()) && awb_number.chars().all(|c| c.is_ascii_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids() -> AccountIds {
        AccountIds {
            pickup_point: 7,
            home_service: 1,
            locker_service: Some(15),
        }
    }

    fn recipient() -> Recipient<'static> {
        Recipient {
            name: "Ana Pop",
            phone: "+40722000000",
            email: Some("ana@example.ro"),
            address: "Str. Florilor 1",
            city: "Ploiești",
            county: "Prahova",
            postal_code: Some("100001"),
        }
    }

    #[test]
    fn form_uses_php_bracket_keys() {
        let form = Form::default()
            .field("awbRecipient[name]", "Ana Pop & Co")
            .field("parcels[0][weight]", "1.500");
        assert_eq!(
            form.encode(),
            "awbRecipient%5Bname%5D=Ana+Pop+%26+Co&parcels%5B0%5D%5Bweight%5D=1.500"
        );
    }

    #[test]
    fn home_awb_splits_weight_across_parcels() {
        let awb = NewAwb {
            ids: ids(),
            locker_id: None,
            recipient: recipient(),
            parcel_count: 2,
            weight_grams: 9000,
            insured_value_cents: 0,
            reference: "order-1",
        };
        let fields = awb.form().unwrap().0;
        let get = |k: &str| {
            fields
                .iter()
                .find(|(key, _)| key == k)
                .map(|(_, v)| v.as_str())
        };
        assert_eq!(get("service"), Some("1"));
        assert_eq!(get("packageWeight"), Some("9.000"));
        assert_eq!(get("parcels[1][weight]"), Some("4.500"));
        assert_eq!(get("awbRecipient[cityString]"), Some("Ploiești"));
        assert_eq!(get("oohLastMile"), None);
        assert_eq!(get("packageType"), Some("0"));
    }

    #[test]
    fn locker_awb_names_the_locker_and_its_service() {
        let awb = NewAwb {
            ids: ids(),
            locker_id: Some(1413),
            recipient: recipient(),
            parcel_count: 1,
            weight_grams: 2700,
            insured_value_cents: 12050,
            reference: "order-2",
        };
        let fields = awb.form().unwrap().0;
        let get = |k: &str| {
            fields
                .iter()
                .find(|(key, _)| key == k)
                .map(|(_, v)| v.as_str())
        };
        assert_eq!(get("service"), Some("15"));
        assert_eq!(get("oohLastMile"), Some("1413"));
        assert_eq!(get("insuredValue"), Some("120.50"));

        let without_service = NewAwb {
            ids: AccountIds {
                locker_service: None,
                ..ids()
            },
            ..awb
        };
        assert!(matches!(
            without_service.form(),
            Err(SamedayError::Rejected(_))
        ));
    }

    #[test]
    fn rejection_collects_nested_field_errors() {
        let body = r#"{"code":400,"message":"Validation Failed","errors":{"children":{
            "awbRecipient":{"children":{"phoneNumber":{"errors":["This value is not valid."]}}},
            "service":{}}}}"#;
        assert_eq!(
            rejection_message(body),
            "awbRecipient.phoneNumber: This value is not valid."
        );
        assert_eq!(rejection_message(r#"{"message":"Nope"}"#), "Nope");
    }

    #[test]
    fn times_with_and_without_offsets() {
        let t = parse_time("2026-07-01 12:00:00").unwrap();
        assert_eq!(t.to_rfc3339(), "2026-07-01T09:00:00+00:00");
        assert!(parse_time("2026-12-01 12:00").is_some());
        let t = parse_time("2019-02-26T09:37:28+0200").unwrap();
        assert_eq!(t.to_rfc3339(), "2019-02-26T07:37:28+00:00");
        assert!(parse_time("2022-04-20T17:57:53+03:00").is_some());
        assert!(parse_time("soon").is_none());
    }

    #[test]
    fn package_type_follows_parcel_weight() {
        assert_eq!(package_type(0.9), 1);
        assert_eq!(package_type(12.0), 0);
        assert_eq!(package_type(40.0), 2);
    }

    #[test]
    fn awb_numbers_are_alphanumeric() {
        assert!(is_valid_awb_number("1ONB24123456789"));
        assert!(!is_valid_awb_number("../awb"));
        assert!(!is_valid_awb_number("12"));
    }
}
