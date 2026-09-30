pub mod account;
pub mod analytics;
pub mod auth;
pub mod blog_crud;
pub mod customer_crud;
pub mod db;
pub mod enum_crud;
pub mod enums;
pub mod error;
pub mod exchange_rate;
pub mod google;
pub mod image_crud;
pub mod language;
pub mod localized;
pub mod lot_crud;
pub mod mailer;
pub mod metrics;
pub mod models;
pub mod newsletter;
pub mod order_crud;
pub mod pagination;
pub mod product_crud;
pub mod retention;
pub mod routes;
pub mod rss_crud;
pub mod sameday;
pub mod schema;
pub mod settings_crud;
pub mod shipments;
pub mod shipping;
pub mod sitemap_crud;
pub mod stripe_checkout;
pub mod tokens;
pub mod user_crud;
pub mod utils;

// Re-exported at the crate root because submodules import `crate::AppError`
// throughout. `ErrorResponse` is part of the public response shape.
pub use crate::error::{AppError, ErrorResponse};

use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DefaultKeyedStateStore};
use std::net::IpAddr;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

pub type IpRateLimiter = RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>;
pub type KeyRateLimiter = RateLimiter<String, DefaultKeyedStateStore<String>, DefaultClock>;

pub fn build_login_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_minute(
        NonZeroU32::new(10).unwrap(),
    )))
}

pub fn build_image_serve_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_second(
        NonZeroU32::new(30).unwrap(),
    )))
}

pub fn build_admin_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_minute(
        NonZeroU32::new(60).unwrap(),
    )))
}

/// A burst of 5 requests, then one more every 2 minutes.
fn build_strict_limiter() -> Arc<IpRateLimiter> {
    let quota = Quota::with_period(Duration::from_secs(120))
        .expect("non-zero period")
        .allow_burst(NonZeroU32::new(5).unwrap());
    Arc::new(RateLimiter::keyed(quota))
}

/// Starting checkout reserves stock, so it gets a far tighter budget than
/// browsing.
pub fn build_checkout_limiter() -> Arc<IpRateLimiter> {
    build_strict_limiter()
}

/// Every newsletter sign-up can send an email, so sign-ups share checkout's
/// strict budget.
pub fn build_newsletter_limiter() -> Arc<IpRateLimiter> {
    build_strict_limiter()
}

/// Every account email request (registration, password reset, email change)
/// can send an email, so they share checkout's strict budget.
pub fn build_account_limiter() -> Arc<IpRateLimiter> {
    build_strict_limiter()
}

/// Password checks per account (logins and re-authentication alike): a burst
/// of 10, then one a minute. Caps guessing against one account at about 60
/// tries an hour, from any number of addresses, without locking out an
/// owner who mistypes a few times.
pub fn build_customer_password_limiter() -> Arc<KeyRateLimiter> {
    let quota =
        Quota::per_minute(NonZeroU32::new(1).unwrap()).allow_burst(NonZeroU32::new(10).unwrap());
    Arc::new(RateLimiter::keyed(quota))
}

/// Site statistics from the browser: a few events per page view, so a minute
/// of steady browsing fits in the burst.
pub fn build_events_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_minute(
        NonZeroU32::new(60).unwrap(),
    )))
}

pub fn build_public_api_limiter() -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_second(
        NonZeroU32::new(30).unwrap(),
    )))
}

pub struct AppState {
    pub pool: db::PgPool,
    pub login_limiter: Arc<IpRateLimiter>,
    pub image_serve_limiter: Arc<IpRateLimiter>,
    pub admin_limiter: Arc<IpRateLimiter>,
    pub public_api_limiter: Arc<IpRateLimiter>,
    pub checkout_limiter: Arc<IpRateLimiter>,
    pub newsletter_limiter: Arc<IpRateLimiter>,
    pub account_limiter: Arc<IpRateLimiter>,
    pub customer_login_limiter: Arc<IpRateLimiter>,
    pub events_limiter: Arc<IpRateLimiter>,
    /// Keyed by `password_limit_key`, never by the address itself.
    pub customer_password_limiter: Arc<KeyRateLimiter>,
    /// Random per-process key for `client_key_hash` and `password_limit_key`;
    /// never persisted, so neither can be linked to an IP or address after a
    /// restart.
    pub client_key_secret: [u8; 32],
    pub site_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub image_upload_dir: String,
    pub stripe_client: stripe::Client,
    pub stripe_webhook_secret: String,
    pub mailer: mailer::Mailer,
    /// `None` when Google sign-in is not configured.
    pub google: google::SharedGoogleClient,
    /// `None` when Sameday is not configured: easybox is not offered and
    /// waybills are made by hand in Sameday's eAWB portal.
    pub sameday: sameday::SharedSamedayClient,
    /// See `newsletter::derive_unsubscribe_key`.
    pub unsubscribe_key: [u8; 32],
    /// Latest known BNR EUR reference rate, kept warm by the refresh task so
    /// request handlers never hit the database for currency conversion.
    pub eur_rate: std::sync::RwLock<Option<exchange_rate::EurRate>>,
}

impl AppState {
    pub fn current_eur_rate(&self) -> Option<exchange_rate::EurRate> {
        *self.eur_rate.read().expect("eur_rate lock poisoned")
    }

    pub fn set_eur_rate(&self, rate: exchange_rate::EurRate) {
        *self.eur_rate.write().expect("eur_rate lock poisoned") = Some(rate);
    }

    /// Pseudonymous, hex-encoded HMAC of the client's network (see
    /// `auth::client_network`), used to cap pending orders per client without
    /// storing the IP itself.
    pub fn client_key_hash(&self, ip: IpAddr) -> String {
        tokens::mac_hex(
            &self.client_key_secret,
            auth::client_network(ip).to_string().as_bytes(),
        )
    }

    /// Rate-limiter key for password attempts on one account, so the limiter
    /// holds no email addresses.
    pub fn password_limit_key(&self, email: &str) -> String {
        tokens::mac_hex(
            &self.client_key_secret,
            format!("password:{email}").as_bytes(),
        )
    }
}

// Crate-root re-exports — only the symbols genuinely shared across
// submodules (`crate::AppError`) or required by the `add_admin_user` bin.
// Everything else is namespaced (`backend::<module>::Symbol`).
pub use crate::user_crud::{create_admin, get_admin};
pub use crate::utils::verify_password;
