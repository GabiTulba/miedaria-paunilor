//! `MODE` selects how the deployment behaves. `prod` is the public shop.
//! `dev` is a test copy (dev.miedaria-paunilor.ro): nginx lets a request
//! through only with a valid access cookie (`routes::dev_access`), email
//! subjects are marked, and live Stripe keys are refused, so a test site can
//! never be mistaken for the shop or charge a real card.

use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};

use crate::tokens;

pub const ACCESS_COOKIE: &str = "__Host-dev_access";
const ACCESS_LIFETIME: chrono::Duration = chrono::Duration::days(30);
const MIN_PASSWORD_CHARS: usize = 12;
const EMAIL_SUBJECT_PREFIX: &str = "[DEV] ";

pub enum SiteMode {
    Prod,
    Dev(DevAccess),
}

/// The shared credentials of a dev site. Only an HMAC of them is kept; the
/// cookie key is derived from them too, so changing either signs everyone
/// out.
pub struct DevAccess {
    key: [u8; 32],
    credentials_mac: String,
}

impl SiteMode {
    pub fn from_env() -> Result<Self, String> {
        let read = |name| std::env::var(name).unwrap_or_default();
        match read("MODE").as_str() {
            "prod" => Ok(SiteMode::Prod),
            "dev" => {
                let (username, password) =
                    (read("DEV_ACCESS_USERNAME"), read("DEV_ACCESS_PASSWORD"));
                if username.trim().is_empty() || password.chars().count() < MIN_PASSWORD_CHARS {
                    return Err(format!(
                        "MODE=dev needs DEV_ACCESS_USERNAME and a DEV_ACCESS_PASSWORD of at least {MIN_PASSWORD_CHARS} characters"
                    ));
                }
                let jwt_secret = read("JWT_SECRET");
                Ok(SiteMode::Dev(DevAccess::new(
                    &jwt_secret,
                    &username,
                    &password,
                )))
            }
            other => Err(format!("MODE must be `dev` or `prod`, not `{other}`")),
        }
    }

    pub fn is_dev(&self) -> bool {
        matches!(self, SiteMode::Dev(_))
    }

    pub fn email_subject_prefix(&self) -> &'static str {
        if self.is_dev() {
            EMAIL_SUBJECT_PREFIX
        } else {
            ""
        }
    }

    /// A dev site must never hold a live Stripe key.
    pub fn check_stripe_key(&self, secret_key: &str) -> Result<(), String> {
        if self.is_dev()
            && !secret_key.starts_with("sk_test_")
            && !secret_key.starts_with("rk_test_")
        {
            return Err("MODE=dev only accepts a Stripe test-mode STRIPE_SECRET_KEY".to_string());
        }
        Ok(())
    }
}

fn credentials_input(username: &str, password: &str) -> Vec<u8> {
    format!("credentials:{}:{username}:{password}", username.len()).into_bytes()
}

impl DevAccess {
    fn new(jwt_secret: &str, username: &str, password: &str) -> Self {
        let key = tokens::derive_key(
            &format!(
                "{jwt_secret}\n{}",
                tokens::hash_token(&format!("{username}\n{password}"))
            ),
            b"dev-access",
        );
        DevAccess {
            key,
            credentials_mac: tokens::mac_hex(&key, &credentials_input(username, password)),
        }
    }

    /// Constant-time check of a login attempt.
    pub fn accepts(&self, username: &str, password: &str) -> bool {
        tokens::verify_mac_hex(
            &self.key,
            &credentials_input(username, password),
            &self.credentials_mac,
        )
    }

    fn cookie_input(expires: i64) -> Vec<u8> {
        format!("cookie:{expires}").into_bytes()
    }

    /// `<expiry>.<hmac>`: needs no server-side storage.
    pub fn cookie(&self) -> Cookie<'static> {
        let expires = (chrono::Utc::now() + ACCESS_LIFETIME).timestamp();
        let mac = tokens::mac_hex(&self.key, &Self::cookie_input(expires));
        Cookie::build((ACCESS_COOKIE, format!("{expires}.{mac}")))
            .path("/")
            .http_only(true)
            .secure(true)
            // Lax so returning from Stripe, Google or an email link keeps access.
            .same_site(SameSite::Lax)
            .max_age(time::Duration::seconds(ACCESS_LIFETIME.num_seconds()))
            .build()
    }

    pub fn accepts_cookie(&self, jar: &CookieJar) -> bool {
        jar.get(ACCESS_COOKIE)
            .and_then(|c| {
                let (expires, mac) = c.value().split_once('.')?;
                let expires = expires.parse::<i64>().ok()?;
                Some(
                    expires > chrono::Utc::now().timestamp()
                        && tokens::verify_mac_hex(&self.key, &Self::cookie_input(expires), mac),
                )
            })
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn access() -> DevAccess {
        DevAccess::new("jwt", "tester", "correct horse battery")
    }

    fn jar_with(value: &str) -> CookieJar {
        CookieJar::new().add(Cookie::new(ACCESS_COOKIE, value.to_string()))
    }

    #[test]
    fn only_the_configured_credentials_are_accepted() {
        let access = access();
        assert!(access.accepts("tester", "correct horse battery"));
        assert!(!access.accepts("tester", "correct horse batter"));
        assert!(!access.accepts("tester:", "correct horse battery"));
    }

    #[test]
    fn issued_cookies_are_accepted_until_tampered_or_expired() {
        let access = access();
        let cookie = access.cookie();
        assert!(access.accepts_cookie(&jar_with(cookie.value())));
        assert!(!access.accepts_cookie(&CookieJar::new()));

        let (_, mac) = cookie.value().split_once('.').unwrap();
        let later = chrono::Utc::now().timestamp() + 999_999_999;
        assert!(!access.accepts_cookie(&jar_with(&format!("{later}.{mac}"))));

        let expired = 1;
        let expired_mac = tokens::mac_hex(&access.key, &DevAccess::cookie_input(expired));
        assert!(!access.accepts_cookie(&jar_with(&format!("{expired}.{expired_mac}"))));

        let other = DevAccess::new("jwt", "tester", "another password!");
        assert!(!other.accepts_cookie(&jar_with(cookie.value())));
    }

    #[test]
    fn dev_mode_refuses_live_stripe_keys() {
        let dev = SiteMode::Dev(access());
        assert!(dev.check_stripe_key("sk_live_abc").is_err());
        assert!(dev.check_stripe_key("sk_test_abc").is_ok());
        assert!(SiteMode::Prod.check_stripe_key("sk_live_abc").is_ok());
    }
}
