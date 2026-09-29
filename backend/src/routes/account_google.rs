//! "Continue with Google" for customer accounts. A Google identity is linked
//! to an account only by its stable subject id. An address that already has
//! an account is never taken over automatically: its owner logs in and
//! connects Google from the settings page.

use std::sync::Arc;

use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Redirect,
    routing::get,
};
use axum_extra::extract::cookie::CookieJar;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::AppError;
use crate::AppState;
use crate::account::{self, AccountEmail, CurrentCustomer};
use crate::auth;
use crate::customer_crud::{self, GOOGLE, LinkOutcome};
use crate::db;
use crate::google::{self, Flow, GoogleIdentity, Intent};
use crate::language::Language;
use crate::models::Customer;
use crate::routes::account::{CurrentPasswordRequest, confirm_identity};
use crate::tokens::hash_token;

const MAX_NEXT_LEN: usize = 200;

#[derive(Serialize, TS)]
#[ts(export)]
pub struct SignInProviders {
    pub google: bool,
}

#[derive(Deserialize)]
struct StartQuery {
    intent: Intent,
    lang: Option<String>,
    next: Option<String>,
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
}

/// Where the callback sends the browser, reported to the page as `?google=`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    SignedIn,
    Linked,
    Reauthenticated,
    /// The address already has an account: log in and connect Google there.
    AccountExists,
    /// This Google account is connected to another account.
    LinkedElsewhere,
    /// The session that started the flow has ended.
    SessionEnded,
    Failed,
}

impl Outcome {
    fn code(self) -> &'static str {
        match self {
            Outcome::SignedIn => "signed-in",
            Outcome::Linked => "linked",
            Outcome::Reauthenticated => "reauthenticated",
            Outcome::AccountExists => "account-exists",
            Outcome::LinkedElsewhere => "linked-elsewhere",
            Outcome::SessionEnded => "session-ended",
            Outcome::Failed => "failed",
        }
    }
}

fn google_client(app_state: &AppState) -> Result<Arc<google::GoogleClient>, AppError> {
    app_state
        .google
        .clone()
        .ok_or_else(|| AppError::NotFound("Google sign-in is not enabled".to_string()))
}

/// A path inside the site to return to; anything else falls back to the
/// account page.
fn safe_next(next: Option<String>) -> String {
    next.filter(|n| {
        n.len() <= MAX_NEXT_LEN
            && n.starts_with('/')
            && !n.starts_with("//")
            && n.chars().all(|c| c.is_ascii_graphic() && c != '\\')
    })
    .unwrap_or_else(|| "/account".to_string())
}

async fn providers(State(app_state): State<Arc<AppState>>) -> Json<SignInProviders> {
    Json(SignInProviders {
        google: app_state.google.is_some(),
    })
}

/// Sends the browser to Google. Linking and re-authentication belong to the
/// session that asks for them.
async fn start(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Query(query): Query<StartQuery>,
) -> Result<(CookieJar, Redirect), AppError> {
    let client = google_client(&app_state)?;
    app_state
        .customer_login_limiter
        .check_key(&auth::client_network(auth::extract_client_ip(&headers)))
        .map_err(|_| AppError::TooManyRequests)?;

    let lang = Language::from_code(query.lang.as_deref().unwrap_or_default());
    let session_hash = match query.intent {
        Intent::SignIn => None,
        Intent::Link | Intent::Reauth => {
            account::current_customer(&app_state, &jar)?
                .ok_or_else(|| AppError::Unauthorized("Not logged in".to_string()))?;
            account::session_token(&jar).map(|t| hash_token(&t))
        }
    };
    let (url, cookie) = client.start(
        query.intent,
        session_hash,
        lang.code(),
        safe_next(query.next),
    );
    Ok((jar.add(cookie), Redirect::to(&url)))
}

/// Google's redirect back. Always answers with a redirect to a site page that
/// reports the outcome; the flow cookie is cleared either way.
async fn callback(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Query(query): Query<CallbackQuery>,
) -> (CookieJar, Redirect) {
    // Read before clearing: adding the removal replaces it in the jar.
    let flow = google::read_flow(&jar);
    let (lang, next) = flow
        .as_ref()
        .map(|f| (f.lang.clone(), f.next.clone()))
        .unwrap_or_else(|| {
            (
                Language::default().code().to_string(),
                "/account".to_string(),
            )
        });
    let jar = jar.add(google::clear_flow_cookie());

    let (jar, outcome) =
        match complete(&app_state, jar.clone(), &headers, flow.as_ref(), query).await {
            Ok(result) => result,
            Err(e) => {
                tracing::warn!(error = %e, "Google sign-in failed");
                (jar, Outcome::Failed)
            }
        };
    let page = match outcome {
        Outcome::SignedIn | Outcome::Linked | Outcome::Reauthenticated => next,
        Outcome::AccountExists | Outcome::SessionEnded => "/account/login".to_string(),
        Outcome::LinkedElsewhere | Outcome::Failed => {
            if flow.is_some_and(|f| f.intent != Intent::SignIn) {
                next
            } else {
                "/account/login".to_string()
            }
        }
    };
    let separator = if page.contains('?') { '&' } else { '?' };
    let url = format!(
        "{}/{lang}{page}{separator}google={}",
        app_state.site_url,
        outcome.code()
    );
    (jar, Redirect::to(&url))
}

#[derive(Debug)]
enum CallbackError {
    Google(google::GoogleError),
    App(AppError),
}

impl std::fmt::Display for CallbackError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CallbackError::Google(e) => write!(f, "{e}"),
            CallbackError::App(e) => write!(f, "{e:?}"),
        }
    }
}

impl From<AppError> for CallbackError {
    fn from(e: AppError) -> Self {
        CallbackError::App(e)
    }
}

impl From<diesel::result::Error> for CallbackError {
    fn from(e: diesel::result::Error) -> Self {
        CallbackError::App(e.into())
    }
}

async fn complete(
    app_state: &Arc<AppState>,
    jar: CookieJar,
    headers: &HeaderMap,
    flow: Option<&Flow>,
    query: CallbackQuery,
) -> Result<(CookieJar, Outcome), CallbackError> {
    let client = google_client(app_state)?;
    // Cancelling on Google's page returns `error` and no code.
    let (Some(code), Some(state)) = (query.code, query.state) else {
        return Ok((jar, Outcome::Failed));
    };
    app_state
        .customer_login_limiter
        .check_key(&auth::client_network(auth::extract_client_ip(headers)))
        .map_err(|_| AppError::TooManyRequests)?;
    let flow = flow.ok_or(CallbackError::Google(google::GoogleError::Rejected(
        "missing or malformed flow cookie",
    )))?;
    let identity = client
        .finish(flow, &state, &code)
        .await
        .map_err(CallbackError::Google)?;

    match flow.intent {
        Intent::SignIn => sign_in(app_state, jar, flow, &identity),
        Intent::Link => link(app_state, jar, flow, &identity),
        Intent::Reauth => reauthenticate(app_state, jar, flow, &identity),
    }
}

/// Logs in the account linked to this Google identity, or creates one for an
/// address that has no account yet. An address that already has one is left
/// to its owner.
fn sign_in(
    app_state: &Arc<AppState>,
    jar: CookieJar,
    flow: &Flow,
    identity: &GoogleIdentity,
) -> Result<(CookieJar, Outcome), CallbackError> {
    let mut conn = db::get_db_connection(app_state)?;
    let customer = match customer_crud::find_by_identity(&mut conn, GOOGLE, &identity.subject)? {
        Some(customer) => customer,
        None => match adopt_or_create(&mut conn, identity, &flow.lang)? {
            Some(customer) => customer,
            None => return Ok((jar, Outcome::AccountExists)),
        },
    };
    trust_google_for_address(&mut conn, &customer, identity)?;
    customer_crud::set_language(&mut conn, customer.id, &flow.lang)?;
    // A fresh token on every login, so a planted cookie is never promoted.
    if let Some(old) = account::session_token(&jar) {
        customer_crud::end_session(&mut conn, &old)?;
    }
    let token = customer_crud::create_session(&mut conn, customer.id)?;
    Ok((jar.add(account::session_cookie(token)), Outcome::SignedIn))
}

/// The account for a Google address that has none: a new one, or a
/// registration nobody finished (no password, no linked sign-in). Returns
/// `None` if the address belongs to an established account.
fn adopt_or_create(
    conn: &mut diesel::PgConnection,
    identity: &GoogleIdentity,
    lang: &str,
) -> Result<Option<Customer>, CallbackError> {
    let customer = customer_crud::find_or_create(conn, &identity.email, lang)?;
    if customer.hashed_password.is_some() || customer_crud::has_identity(conn, customer.id)? {
        return Ok(None);
    }
    match customer_crud::link_identity(conn, customer.id, GOOGLE, &identity.subject)? {
        LinkOutcome::Linked | LinkOutcome::AlreadyLinked => Ok(Some(customer)),
        LinkOutcome::Conflict => Ok(None),
    }
}

/// Google proves ownership only of the addresses it hosts. For those, the
/// account's address counts as verified and its guest orders are linked;
/// for any other address, only emailed links can do that.
fn trust_google_for_address(
    conn: &mut diesel::PgConnection,
    customer: &Customer,
    identity: &GoogleIdentity,
) -> Result<(), CallbackError> {
    if identity.email_authoritative && identity.email == customer.email {
        customer_crud::verify_email_by_provider(conn, customer)?;
    }
    Ok(())
}

/// The account of the session that started the flow, if it is still live.
fn flow_session_customer(
    conn: &mut diesel::PgConnection,
    flow: &Flow,
) -> Result<Option<Customer>, CallbackError> {
    let Some(hash) = flow.session_hash.as_deref() else {
        return Ok(None);
    };
    Ok(customer_crud::session_by_hash(conn, hash)?
        .map(|session| customer_crud::get(conn, session.customer_id))
        .transpose()?)
}

fn link(
    app_state: &Arc<AppState>,
    jar: CookieJar,
    flow: &Flow,
    identity: &GoogleIdentity,
) -> Result<(CookieJar, Outcome), CallbackError> {
    let mut conn = db::get_db_connection(app_state)?;
    let Some(customer) = flow_session_customer(&mut conn, flow)? else {
        return Ok((jar, Outcome::SessionEnded));
    };
    match customer_crud::link_identity(&mut conn, customer.id, GOOGLE, &identity.subject)? {
        LinkOutcome::Linked => {
            trust_google_for_address(&mut conn, &customer, identity)?;
            account::send(app_state, &customer, AccountEmail::GoogleLinked);
            Ok((jar, Outcome::Linked))
        }
        LinkOutcome::AlreadyLinked => Ok((jar, Outcome::Linked)),
        LinkOutcome::Conflict => Ok((jar, Outcome::LinkedElsewhere)),
    }
}

/// Replaces the session that asked with a freshly signed-in one, which
/// stands in for a password on sensitive actions for a few minutes.
fn reauthenticate(
    app_state: &Arc<AppState>,
    jar: CookieJar,
    flow: &Flow,
    identity: &GoogleIdentity,
) -> Result<(CookieJar, Outcome), CallbackError> {
    let mut conn = db::get_db_connection(app_state)?;
    let Some(customer) = flow_session_customer(&mut conn, flow)? else {
        return Ok((jar, Outcome::SessionEnded));
    };
    let owner = customer_crud::find_by_identity(&mut conn, GOOGLE, &identity.subject)?;
    if owner.is_none_or(|owner| owner.id != customer.id) {
        return Ok((jar, Outcome::LinkedElsewhere));
    }
    if let Some(hash) = flow.session_hash.as_deref() {
        customer_crud::end_session_by_hash(&mut conn, hash)?;
    }
    let token = customer_crud::create_session(&mut conn, customer.id)?;
    Ok((
        jar.add(account::session_cookie(token)),
        Outcome::Reauthenticated,
    ))
}

/// Disconnects Google. Only an account with a password can, so nobody locks
/// themselves out.
async fn unlink(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    headers: HeaderMap,
    Json(request): Json<CurrentPasswordRequest>,
) -> Result<StatusCode, AppError> {
    if current.customer.hashed_password.is_none() {
        return Err(AppError::Conflict(
            "Set a password before disconnecting Google".to_string(),
        ));
    }
    confirm_identity(&app_state, &headers, &current, request.current_password).await?;
    let mut conn = db::get_db_connection(&app_state)?;
    if customer_crud::unlink_identity(&mut conn, current.customer.id, GOOGLE)? {
        account::send(&app_state, &current.customer, AccountEmail::GoogleUnlinked);
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Public routes; the start and callback are browser navigations, so the
/// same-origin guard (non-GET only) leaves them alone.
pub fn public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/account/providers", get(providers))
        .route("/api/account/google/start", get(start))
        .route(google::CALLBACK_PATH, get(callback))
}

/// Routes that need a session.
pub fn authenticated_router() -> Router<Arc<AppState>> {
    Router::new().route("/api/account/google", axum::routing::delete(unlink))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn return_path_stays_on_site() {
        assert_eq!(
            safe_next(Some("/account/settings".into())),
            "/account/settings"
        );
        assert_eq!(safe_next(Some("/cart?x=1".into())), "/cart?x=1");
        for bad in [
            "//evil.test",
            "/\\evil.test",
            "https://evil.test",
            "account",
            "/a b",
        ] {
            assert_eq!(safe_next(Some(bad.into())), "/account", "{bad}");
        }
        assert_eq!(safe_next(None), "/account");
    }
}
