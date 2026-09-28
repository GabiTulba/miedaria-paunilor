pub mod auth;
pub mod blog_crud;
pub mod db;
pub mod enum_crud;
pub mod enums;
pub mod error;
pub mod exchange_rate;
pub mod image_crud;
pub mod language;
pub mod localized;
pub mod lot_crud;
pub mod mailer;
pub mod models;
pub mod newsletter;
pub mod order_crud;
pub mod pagination;
pub mod product_crud;
pub mod routes;
pub mod rss_crud;
pub mod schema;
pub mod settings_crud;
pub mod sitemap_crud;
pub mod stripe_checkout;
pub mod user_crud;
pub mod utils;

// Re-exported at the crate root because submodules import `crate::AppError`
// throughout. `ErrorResponse` is part of the public response shape.
pub use crate::error::{AppError, ErrorResponse};

use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DefaultKeyedStateStore};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::net::IpAddr;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

pub type IpRateLimiter = RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>;

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

/// Random HMAC key for `AppState::client_key_hash`. Never persisted, so the
/// stored hashes become unlinkable to any IP once the process restarts.
pub fn generate_client_key_secret() -> [u8; 32] {
    use argon2::password_hash::rand_core::{OsRng, RngCore};
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    key
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
    pub client_key_secret: [u8; 32],
    pub site_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub image_upload_dir: String,
    pub stripe_client: stripe::Client,
    pub stripe_webhook_secret: String,
    pub mailer: mailer::Mailer,
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
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.client_key_secret)
            .expect("HMAC accepts any key length");
        mac.update(auth::client_network(ip).to_string().as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }
}

// Crate-root re-exports — only the symbols genuinely shared across
// submodules (`crate::AppError`) or required by the `add_admin_user` bin.
// Everything else is namespaced (`backend::<module>::Symbol`).
pub use crate::user_crud::{create_admin, get_admin};
pub use crate::utils::verify_password;
