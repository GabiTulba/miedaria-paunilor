//! "Sign in with Google" over OpenID Connect (authorization code flow with
//! PKCE). The browser only ever carries Google's one-time code; the backend
//! exchanges it with the client secret and verifies the ID token itself, so no
//! Google script runs on the site.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::RwLock;

use crate::tokens;

const AUTHORIZATION_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const JWKS_URI: &str = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS: [&str; 2] = ["https://accounts.google.com", "accounts.google.com"];
const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
/// Google rotates its signing keys every few weeks and publishes new ones
/// well ahead; an unknown key id triggers an early refresh anyway.
const JWKS_MAX_AGE: Duration = Duration::from_secs(6 * 60 * 60);
const JWKS_MIN_REFRESH: Duration = Duration::from_secs(60);

/// The in-flight sign-in, bound to the browser that started it.
pub const FLOW_COOKIE: &str = "__Host-google_flow";
/// Long enough to pick an account and consent, short enough to be useless
/// if leaked.
const FLOW_MAX_AGE_SECS: i64 = 10 * 60;
pub const CALLBACK_PATH: &str = "/api/account/google/callback";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Intent {
    /// Log in, or create an account for a new address.
    SignIn,
    /// Connect Google to the logged-in account.
    Link,
    /// Prove presence again before a sensitive action (accounts without a
    /// password).
    Reauth,
}

/// Everything the callback must check, kept in an HttpOnly cookie that Google
/// never sees. `state` binds the callback to this browser (login CSRF), the
/// `nonce` binds the ID token to this request (replay), and the PKCE verifier
/// makes a stolen code useless without the cookie.
#[derive(Serialize, Deserialize)]
pub struct Flow {
    pub state: String,
    pub nonce: String,
    pub verifier: String,
    pub intent: Intent,
    /// Hash of the session that started a link or re-authentication, so the
    /// result applies to that session only.
    pub session_hash: Option<String>,
    pub lang: String,
    /// Same-site page to return to.
    pub next: String,
}

pub struct GoogleConfig {
    pub client_id: String,
    pub client_secret: String,
}

pub struct GoogleClient {
    config: GoogleConfig,
    redirect_uri: String,
    http: reqwest::Client,
    jwks: RwLock<Option<(JwkSet, Instant)>>,
}

/// The verified claims of a Google sign-in this backend relies on.
#[derive(Debug)]
pub struct GoogleIdentity {
    pub subject: String,
    /// Lowercased.
    pub email: String,
    /// Whether Google, not just the user, controls this address, so it may
    /// stand as proof of ownership (see `email_is_authoritative`).
    pub email_authoritative: bool,
}

#[derive(Deserialize)]
struct IdClaims {
    sub: String,
    email: Option<String>,
    #[serde(default)]
    email_verified: bool,
    /// Google Workspace domain, present only for organisation accounts.
    hd: Option<String>,
    nonce: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    id_token: String,
}

#[derive(Debug)]
pub enum GoogleError {
    /// The response did not match the flow this browser started.
    Rejected(&'static str),
    Upstream(String),
}

impl std::fmt::Display for GoogleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GoogleError::Rejected(reason) => write!(f, "rejected: {reason}"),
            GoogleError::Upstream(e) => write!(f, "upstream: {e}"),
        }
    }
}

/// Google only proves ownership of the addresses it hosts: Gmail, and
/// Workspace domains (the `hd` claim, which must match the address). A
/// Google account can also be registered on any other address, where
/// `email_verified` only means the address was reachable once.
pub fn email_is_authoritative(email: &str, hd: Option<&str>) -> bool {
    let Some(domain) = email.rsplit_once('@').map(|(_, d)| d) else {
        return false;
    };
    domain == "gmail.com"
        || domain == "googlemail.com"
        || hd.is_some_and(|hd| hd.eq_ignore_ascii_case(domain))
}

fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

impl GoogleClient {
    pub fn new(config: GoogleConfig, site_url: &str) -> Result<Self, String> {
        let http = reqwest::Client::builder()
            .timeout(HTTP_TIMEOUT)
            .user_agent("miedaria-paunilor-backend")
            .build()
            .map_err(|e| format!("cannot build HTTP client for Google sign-in: {e}"))?;
        Ok(Self {
            config,
            redirect_uri: format!("{site_url}{CALLBACK_PATH}"),
            http,
            jwks: RwLock::new(None),
        })
    }

    /// Starts a flow: the Google URL to send the browser to, and the cookie
    /// that lets the callback finish it.
    pub fn start(
        &self,
        intent: Intent,
        session_hash: Option<String>,
        lang: &str,
        next: String,
    ) -> (String, Cookie<'static>) {
        let flow = Flow {
            state: tokens::random_token(),
            nonce: tokens::random_token(),
            verifier: tokens::random_token(),
            intent,
            session_hash,
            lang: lang.to_string(),
            next,
        };
        let mut url = reqwest::Url::parse(AUTHORIZATION_ENDPOINT).expect("static URL parses");
        url.query_pairs_mut()
            .append_pair("client_id", &self.config.client_id)
            .append_pair("redirect_uri", &self.redirect_uri)
            .append_pair("response_type", "code")
            .append_pair("scope", "openid email")
            .append_pair("state", &flow.state)
            .append_pair("nonce", &flow.nonce)
            .append_pair("code_challenge", &pkce_challenge(&flow.verifier))
            .append_pair("code_challenge_method", "S256")
            .append_pair("hl", lang);
        if intent != Intent::SignIn {
            // Always ask Google to show the account picker and re-check the
            // user, rather than silently reusing whoever is signed in there.
            url.query_pairs_mut()
                .append_pair("prompt", "select_account")
                .append_pair("max_age", "0");
        }
        let value = serde_json::to_string(&flow).expect("flow serializes");
        (url.into(), flow_cookie(URL_SAFE_NO_PAD.encode(value)))
    }

    /// Finishes the flow this browser started (read from its cookie) with the
    /// callback's `state` and `code`, returning the verified identity.
    pub async fn finish(
        &self,
        flow: &Flow,
        state: &str,
        code: &str,
    ) -> Result<GoogleIdentity, GoogleError> {
        if !constant_time_eq(flow.state.as_bytes(), state.as_bytes()) {
            return Err(GoogleError::Rejected("state mismatch"));
        }
        let id_token = self.exchange_code(code, &flow.verifier).await?;
        self.verify_id_token(&id_token, &flow.nonce).await
    }

    async fn exchange_code(&self, code: &str, verifier: &str) -> Result<String, GoogleError> {
        let response = self
            .http
            .post(TOKEN_ENDPOINT)
            .form(&[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", &self.redirect_uri),
                ("client_id", &self.config.client_id),
                ("client_secret", &self.config.client_secret),
                ("code_verifier", verifier),
            ])
            .send()
            .await
            .map_err(|e| GoogleError::Upstream(format!("token request failed: {e}")))?;
        if response.status().is_client_error() {
            // An expired, reused or forged code.
            return Err(GoogleError::Rejected("code exchange refused"));
        }
        let response = response
            .error_for_status()
            .map_err(|e| GoogleError::Upstream(format!("token endpoint: {e}")))?;
        response
            .json::<TokenResponse>()
            .await
            .map(|t| t.id_token)
            .map_err(|e| GoogleError::Upstream(format!("token response: {e}")))
    }

    async fn verify_id_token(
        &self,
        id_token: &str,
        nonce: &str,
    ) -> Result<GoogleIdentity, GoogleError> {
        let header =
            decode_header(id_token).map_err(|_| GoogleError::Rejected("malformed ID token"))?;
        if header.alg != Algorithm::RS256 {
            return Err(GoogleError::Rejected("unexpected ID token algorithm"));
        }
        let kid = header
            .kid
            .ok_or(GoogleError::Rejected("ID token without key id"))?;
        let key = self.decoding_key(&kid).await?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[&self.config.client_id]);
        validation.set_issuer(&ISSUERS);
        validation.set_required_spec_claims(&["exp", "iat", "iss", "aud", "sub"]);
        validation.leeway = 60;
        let claims = decode::<IdClaims>(id_token, &key, &validation)
            .map_err(|_| GoogleError::Rejected("ID token failed verification"))?
            .claims;

        if !claims
            .nonce
            .is_some_and(|n| constant_time_eq(n.as_bytes(), nonce.as_bytes()))
        {
            return Err(GoogleError::Rejected("nonce mismatch"));
        }
        let email = claims
            .email
            .filter(|_| claims.email_verified)
            .and_then(|e| crate::mailer::normalize_email(&e))
            .ok_or(GoogleError::Rejected("no verified email"))?
            .to_string();
        Ok(GoogleIdentity {
            email_authoritative: email_is_authoritative(&email, claims.hd.as_deref()),
            subject: claims.sub,
            email,
        })
    }

    /// Google's signing key `kid`, from the cached key set, refreshed when
    /// stale or when an unknown key id appears (at most once a minute).
    async fn decoding_key(&self, kid: &str) -> Result<DecodingKey, GoogleError> {
        let lookup = |set: &JwkSet| set.find(kid).map(DecodingKey::from_jwk);
        if let Some((set, fetched)) = self.jwks.read().await.as_ref()
            && fetched.elapsed() < JWKS_MAX_AGE
        {
            if let Some(key) = lookup(set) {
                return key.map_err(|_| GoogleError::Rejected("unusable signing key"));
            }
            if fetched.elapsed() < JWKS_MIN_REFRESH {
                return Err(GoogleError::Rejected("unknown signing key"));
            }
        }
        let mut cache = self.jwks.write().await;
        let set = self
            .http
            .get(JWKS_URI)
            .send()
            .await
            .and_then(|r| r.error_for_status())
            .map_err(|e| GoogleError::Upstream(format!("JWKS request failed: {e}")))?
            .json::<JwkSet>()
            .await
            .map_err(|e| GoogleError::Upstream(format!("JWKS response: {e}")))?;
        let key = lookup(&set);
        *cache = Some((set, Instant::now()));
        key.ok_or(GoogleError::Rejected("unknown signing key"))?
            .map_err(|_| GoogleError::Rejected("unusable signing key"))
    }
}

/// Lax, not Strict: the callback is a top-level navigation coming back from
/// accounts.google.com, which Strict would strip. The cookie only holds
/// per-flow secrets that are useless without the matching Google response.
fn flow_cookie(value: String) -> Cookie<'static> {
    Cookie::build((FLOW_COOKIE, value))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::seconds(FLOW_MAX_AGE_SECS))
        .build()
}

pub fn clear_flow_cookie() -> Cookie<'static> {
    let mut cookie = flow_cookie(String::new());
    cookie.set_max_age(time::Duration::ZERO);
    cookie
}

pub fn read_flow(jar: &CookieJar) -> Option<Flow> {
    let raw = URL_SAFE_NO_PAD.decode(jar.get(FLOW_COOKIE)?.value()).ok()?;
    serde_json::from_slice(&raw).ok()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

pub type SharedGoogleClient = Option<Arc<GoogleClient>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn google_is_authoritative_only_for_its_own_addresses() {
        assert!(email_is_authoritative("ana@gmail.com", None));
        assert!(email_is_authoritative("ana@googlemail.com", None));
        assert!(email_is_authoritative("ana@firma.ro", Some("firma.ro")));
        assert!(!email_is_authoritative("ana@firma.ro", None));
        assert!(!email_is_authoritative(
            "ana@firma.ro",
            Some("alta-firma.ro")
        ));
        assert!(!email_is_authoritative("ana@yahoo.com", None));
    }

    #[test]
    fn pkce_challenge_matches_rfc_7636_example() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn flow_cookie_round_trips() {
        let client = GoogleClient::new(
            GoogleConfig {
                client_id: "id".into(),
                client_secret: "secret".into(),
            },
            "https://localhost",
        )
        .unwrap();
        let (url, cookie) = client.start(Intent::Link, Some("h".into()), "ro", "/account".into());
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("prompt=select_account"));
        assert!(url.contains(&format!(
            "redirect_uri={}",
            "https%3A%2F%2Flocalhost%2Fapi%2Faccount%2Fgoogle%2Fcallback"
        )));
        let jar = CookieJar::new().add(cookie);
        let flow = read_flow(&jar).unwrap();
        assert_eq!(flow.intent, Intent::Link);
        assert!(url.contains(&format!("state={}", flow.state)));
        assert!(!url.contains(&flow.verifier));
    }
}
