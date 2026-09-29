//! Customer account endpoints under `/api/account`. Every state-changing
//! request passes the same-origin guard; everything but registration, login
//! and the emailed-token endpoints needs a live session.

use std::sync::Arc;

use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{AppendHeaders, IntoResponse},
    routing::{get, post},
};
use axum_extra::extract::cookie::CookieJar;
use diesel::Connection;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::AppError;
use crate::AppState;
use crate::account::{self, AccountEmail, CurrentCustomer};
use crate::auth::{self, dummy_password_hash};
use crate::customer_crud::{
    self, EMAIL_CHANGE_TOKEN_TTL, PASSWORD_RESET_TOKEN_TTL, REGISTRATION_TOKEN_TTL,
};
use crate::db;
use crate::enums::CustomerTokenPurpose;
use crate::language::Language;
use crate::mailer::normalize_email;
use crate::metrics::{self, LoginResult};
use crate::models::{AccountOrder, AccountOrderWithItems, Customer, PaginatedResponse};
use crate::newsletter;
use crate::pagination::{self, PageQuery};
use crate::routes::account_google;

const ORDERS_PER_PAGE: u32 = 10;
const MAX_ORDERS_PER_PAGE: u32 = 50;

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct AccountEmailRequest {
    pub email: String,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct AccountLoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct SetPasswordRequest {
    pub token: String,
    pub password: String,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct TokenRequest {
    pub token: String,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct ChangeEmailRequest {
    pub new_email: String,
    /// Omitted by accounts without a password; see `confirm_identity`.
    #[serde(default)]
    #[ts(optional)]
    pub current_password: Option<String>,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

/// Confirms a destructive or data-revealing action.
#[derive(Deserialize, TS)]
#[ts(export)]
pub struct CurrentPasswordRequest {
    /// Omitted by accounts without a password; see `confirm_identity`.
    #[serde(default)]
    #[ts(optional)]
    pub current_password: Option<String>,
}

#[derive(Serialize, TS)]
#[ts(export)]
pub struct AccountProfile {
    pub email: String,
    pub language: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Accounts created with Google may have none; they confirm sensitive
    /// actions by signing in with Google again.
    pub has_password: bool,
    pub google_linked: bool,
    /// For an account without a password: until when this session may
    /// perform sensitive actions without signing in with Google again.
    pub reauthenticated_until: Option<chrono::DateTime<chrono::Utc>>,
}

fn profile(
    app_state: &Arc<AppState>,
    current: &CurrentCustomer,
) -> Result<AccountProfile, AppError> {
    let customer = &current.customer;
    let mut conn = db::get_db_connection(app_state)?;
    Ok(AccountProfile {
        email: customer.email.clone(),
        language: customer.language.clone(),
        created_at: customer.created_at,
        has_password: customer.hashed_password.is_some(),
        google_linked: customer_crud::identity_linked_at(
            &mut conn,
            customer.id,
            customer_crud::GOOGLE,
        )?
        .is_some(),
        reauthenticated_until: customer
            .hashed_password
            .is_none()
            .then(|| current.reauthenticated_until()),
    })
}

/// A session that has just been signed in.
fn fresh(customer: Customer) -> CurrentCustomer {
    CurrentCustomer {
        customer,
        signed_in_at: chrono::Utc::now(),
    }
}

#[derive(Serialize)]
struct IdentityExport {
    provider: &'static str,
    linked_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct AccountExport {
    exported_at: chrono::DateTime<chrono::Utc>,
    profile: AccountProfile,
    email_verified_at: Option<chrono::DateTime<chrono::Utc>>,
    sign_in_providers: Vec<IdentityExport>,
    newsletter: Option<newsletter::SubscriptionExport>,
    orders: Vec<AccountOrderWithItems>,
}

fn limit_client(app_state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    app_state
        .account_limiter
        .check_key(&auth::client_network(auth::extract_client_ip(headers)))
        .map_err(|_| AppError::TooManyRequests)
}

fn invalid_email() -> AppError {
    AppError::BadRequest("Invalid email address".to_string())
}

fn invalid_token() -> AppError {
    AppError::NotFound("This link is invalid or has expired".to_string())
}

/// Checks a customer password under both the per-network and the per-account
/// limit. `customer` is `None` (or has no password yet) for unknown addresses,
/// which are checked against a dummy hash so timing does not reveal them.
async fn check_password(
    app_state: &AppState,
    headers: &HeaderMap,
    email: &str,
    customer: Option<&Customer>,
    password: String,
) -> Result<(), AppError> {
    let network = auth::client_network(auth::extract_client_ip(headers));
    let throttled = app_state
        .customer_login_limiter
        .check_key(&network)
        .is_err()
        || app_state
            .customer_password_limiter
            .check_key(&app_state.password_limit_key(email))
            .is_err();
    if throttled {
        metrics::record_login(LoginResult::throttled);
        return Err(AppError::TooManyRequests);
    }

    let stored = customer
        .and_then(|c| c.hashed_password.clone())
        .unwrap_or_else(|| dummy_password_hash().to_string());
    let valid = account::verify_password_blocking(password, stored).await
        && customer.is_some_and(|c| c.hashed_password.is_some());
    if valid {
        metrics::record_login(LoginResult::success);
        Ok(())
    } else {
        metrics::record_login(LoginResult::failure);
        Err(AppError::Unauthorized(
            "Invalid email or password".to_string(),
        ))
    }
}

/// Confirms a sensitive action: with the current password, or, for an
/// account that has none, with a Google sign-in in the last few minutes.
pub(crate) async fn confirm_identity(
    app_state: &AppState,
    headers: &HeaderMap,
    current: &CurrentCustomer,
    password: Option<String>,
) -> Result<(), AppError> {
    let customer = &current.customer;
    match (&customer.hashed_password, password) {
        (Some(_), Some(password)) => {
            check_password(
                app_state,
                headers,
                &customer.email,
                Some(customer),
                password,
            )
            .await
        }
        (Some(_), None) => Err(AppError::Unauthorized(
            "Current password required".to_string(),
        )),
        (None, _) if current.recently_signed_in() => Ok(()),
        (None, _) => Err(AppError::Forbidden(REAUTH_REQUIRED.to_string())),
    }
}

/// Sent with 403 when a password-less account must sign in with Google again.
const REAUTH_REQUIRED: &str = "Sign in with Google again to confirm";

fn start_session(
    app_state: &Arc<AppState>,
    jar: CookieJar,
    customer_id: Uuid,
) -> Result<CookieJar, AppError> {
    let mut conn = db::get_db_connection(app_state)?;
    let token = customer_crud::create_session(&mut conn, customer_id)?;
    Ok(jar.add(account::session_cookie(token)))
}

/// An account someone can log in to (with a password or Google), as opposed
/// to a registration whose link was never used.
fn is_established(conn: &mut diesel::PgConnection, customer: &Customer) -> Result<bool, AppError> {
    Ok(customer.hashed_password.is_some() || customer_crud::has_identity(conn, customer.id)?)
}

/// Always answers 204 for a valid address, whether new or already
/// registered, so the form cannot be used to find out who has an account.
async fn register(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    lang: Language,
    Json(request): Json<AccountEmailRequest>,
) -> Result<StatusCode, AppError> {
    limit_client(&app_state, &headers)?;
    let email = normalize_email(&request.email).ok_or_else(invalid_email)?;

    let mut conn = db::get_db_connection(&app_state)?;
    let customer = customer_crud::find_or_create(&mut conn, email.as_ref(), lang.code())?;
    let registered = is_established(&mut conn, &customer)?;
    let ttl = if registered {
        PASSWORD_RESET_TOKEN_TTL
    } else {
        REGISTRATION_TOKEN_TTL
    };
    let token = customer_crud::issue_token(
        &mut conn,
        customer.id,
        CustomerTokenPurpose::SetPassword,
        ttl,
        None,
    )?;
    if let Some(token) = token {
        let email = if registered {
            AccountEmail::AlreadyRegistered { token: &token }
        } else {
            AccountEmail::Registration { token: &token }
        };
        account::send_to(&app_state, &customer.email, lang, email);
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Always answers 204, so it cannot be used to find out who has an account.
async fn request_password_reset(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<AccountEmailRequest>,
) -> Result<StatusCode, AppError> {
    limit_client(&app_state, &headers)?;
    let email = normalize_email(&request.email).ok_or_else(invalid_email)?;

    let mut conn = db::get_db_connection(&app_state)?;
    let Some(customer) = customer_crud::find_by_email(&mut conn, email.as_ref())? else {
        return Ok(StatusCode::NO_CONTENT);
    };
    // An unfinished registration gets its registration link again instead.
    let registered = is_established(&mut conn, &customer)?;
    let ttl = if registered {
        PASSWORD_RESET_TOKEN_TTL
    } else {
        REGISTRATION_TOKEN_TTL
    };
    let token = customer_crud::issue_token(
        &mut conn,
        customer.id,
        CustomerTokenPurpose::SetPassword,
        ttl,
        None,
    )?;
    if let Some(token) = token {
        let email = if registered {
            AccountEmail::PasswordReset { token: &token }
        } else {
            AccountEmail::Registration { token: &token }
        };
        account::send(&app_state, &customer, email);
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Finishes a registration or a password reset. The token proves the caller
/// reads the account's inbox, which verifies the address and links the guest
/// orders placed with it. Every other session ends, then a new one starts.
async fn set_password(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(request): Json<SetPasswordRequest>,
) -> Result<(CookieJar, Json<AccountProfile>), AppError> {
    let customer = {
        let mut conn = db::get_db_connection(&app_state)?;
        customer_crud::token_owner(&mut conn, CustomerTokenPurpose::SetPassword, &request.token)?
            .ok_or_else(invalid_token)?
    };
    account::check_password(&request.password, &customer.email).map_err(AppError::WeakPassword)?;
    let hashed = account::hash_password_blocking(request.password).await?;

    let mut conn = db::get_db_connection(&app_state)?;
    let was_registered = customer.hashed_password.is_some();
    conn.transaction::<_, AppError, _>(|conn| {
        let (customer_id, _) =
            customer_crud::consume_token(conn, CustomerTokenPurpose::SetPassword, &request.token)?
                .filter(|(id, _)| *id == customer.id)
                .ok_or_else(invalid_token)?;
        customer_crud::set_password(conn, customer_id, &hashed)?;
        customer_crud::end_sessions(conn, customer_id, None)?;
        customer_crud::link_guest_orders(conn, customer_id, &customer.email)?;
        Ok(())
    })?;
    drop(conn);
    if was_registered {
        account::send(&app_state, &customer, AccountEmail::PasswordChanged);
    }
    let jar = start_session(&app_state, jar, customer.id)?;
    let customer = customer_crud::get(&mut *db::get_db_connection(&app_state)?, customer.id)?;
    Ok((jar, Json(profile(&app_state, &fresh(customer))?)))
}

async fn login(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    lang: Language,
    Json(request): Json<AccountLoginRequest>,
) -> Result<(CookieJar, Json<AccountProfile>), AppError> {
    let email = normalize_email(&request.email)
        .map(|a| a.to_string())
        .unwrap_or_default();
    let customer = {
        let mut conn = db::get_db_connection(&app_state)?;
        customer_crud::find_by_email(&mut conn, &email)?
    };
    check_password(
        &app_state,
        &headers,
        &email,
        customer.as_ref(),
        request.password,
    )
    .await?;
    let customer = customer.expect("a verified password implies an account");

    {
        let mut conn = db::get_db_connection(&app_state)?;
        customer_crud::set_language(&mut conn, customer.id, lang.code())?;
    }
    // A fresh token on every login, so a planted cookie is never promoted.
    if let Some(old) = account::session_token(&jar) {
        let mut conn = db::get_db_connection(&app_state)?;
        customer_crud::end_session(&mut conn, &old)?;
    }
    let jar = start_session(&app_state, jar, customer.id)?;
    Ok((jar, Json(profile(&app_state, &fresh(customer))?)))
}

async fn logout(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
) -> Result<(CookieJar, StatusCode), AppError> {
    if let Some(token) = account::session_token(&jar) {
        let mut conn = db::get_db_connection(&app_state)?;
        customer_crud::end_session(&mut conn, &token)?;
    }
    Ok((
        jar.add(account::clear_session_cookie()),
        StatusCode::NO_CONTENT,
    ))
}

async fn logout_everywhere(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    jar: CookieJar,
) -> Result<(CookieJar, StatusCode), AppError> {
    let customer = current.customer;
    let mut conn = db::get_db_connection(&app_state)?;
    customer_crud::end_sessions(&mut conn, customer.id, None)?;
    Ok((
        jar.add(account::clear_session_cookie()),
        StatusCode::NO_CONTENT,
    ))
}

/// The logged-in customer, or `null`, so the site can ask on every page load
/// without an error.
async fn me(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<Option<AccountProfile>>), AppError> {
    let current = account::current_customer(&app_state, &jar)?;
    // Drop a cookie whose session has ended.
    let jar = match (&current, account::session_token(&jar)) {
        (None, Some(_)) => jar.add(account::clear_session_cookie()),
        _ => jar,
    };
    let profile = current.map(|c| profile(&app_state, &c)).transpose()?;
    Ok((jar, Json(profile)))
}

/// Emails a confirmation link to the new address and a notice to the current
/// one. Answers 204 even if the new address is taken, so the form cannot be
/// used to find out who has an account.
async fn change_email(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    headers: HeaderMap,
    Json(request): Json<ChangeEmailRequest>,
) -> Result<StatusCode, AppError> {
    confirm_identity(&app_state, &headers, &current, request.current_password).await?;
    let customer = current.customer;
    limit_client(&app_state, &headers)?;
    let new_email = normalize_email(&request.new_email).ok_or_else(invalid_email)?;
    if new_email.as_ref() == customer.email {
        return Ok(StatusCode::NO_CONTENT);
    }

    let mut conn = db::get_db_connection(&app_state)?;
    let token = customer_crud::issue_token(
        &mut conn,
        customer.id,
        CustomerTokenPurpose::ChangeEmail,
        EMAIL_CHANGE_TOKEN_TTL,
        Some(new_email.as_ref()),
    )?;
    if let Some(token) = token {
        let lang = Language::from_code(&customer.language);
        account::send_to(
            &app_state,
            new_email.as_ref(),
            lang,
            AccountEmail::ConfirmEmailChange { token: &token },
        );
        account::send(
            &app_state,
            &customer,
            AccountEmail::EmailChangeRequested {
                new_email: new_email.as_ref(),
            },
        );
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Completes an email change. Works without a session, since the link is
/// often opened on another device; other sessions end.
async fn confirm_email_change(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(request): Json<TokenRequest>,
) -> Result<StatusCode, AppError> {
    let keep = account::session_token(&jar);
    let mut conn = db::get_db_connection(&app_state)?;
    conn.transaction::<_, AppError, _>(|conn| {
        let (customer_id, new_email) =
            customer_crud::consume_token(conn, CustomerTokenPurpose::ChangeEmail, &request.token)?
                .ok_or_else(invalid_token)?;
        let new_email = new_email.ok_or_else(invalid_token)?;
        if !customer_crud::change_email(conn, customer_id, &new_email)? {
            return Err(AppError::Conflict(
                "This address already belongs to an account".to_string(),
            ));
        }
        customer_crud::end_sessions(conn, customer_id, keep.as_deref())?;
        customer_crud::link_guest_orders(conn, customer_id, &new_email)?;
        Ok(())
    })?;
    Ok(StatusCode::NO_CONTENT)
}

async fn change_password(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(request): Json<ChangePasswordRequest>,
) -> Result<StatusCode, AppError> {
    let customer = current.customer;
    check_password(
        &app_state,
        &headers,
        &customer.email,
        Some(&customer),
        request.current_password,
    )
    .await?;
    account::check_password(&request.new_password, &customer.email)
        .map_err(AppError::WeakPassword)?;
    let hashed = account::hash_password_blocking(request.new_password).await?;

    let mut conn = db::get_db_connection(&app_state)?;
    customer_crud::set_password(&mut conn, customer.id, &hashed)?;
    customer_crud::end_sessions(
        &mut conn,
        customer.id,
        account::session_token(&jar).as_deref(),
    )?;
    account::send(&app_state, &customer, AccountEmail::PasswordChanged);
    Ok(StatusCode::NO_CONTENT)
}

async fn list_orders(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    Query(query): Query<PageQuery>,
) -> Result<Json<PaginatedResponse<AccountOrder>>, AppError> {
    let customer = current.customer;
    let page = query.resolve(ORDERS_PER_PAGE, MAX_ORDERS_PER_PAGE);
    let mut conn = db::get_db_connection(&app_state)?;
    let total = customer_crud::count_orders(&mut conn, customer.id)?;
    let items = customer_crud::list_orders(&mut conn, customer.id, page.limit, page.offset)?;
    Ok(Json(PaginatedResponse {
        items,
        total_pages: pagination::total_pages(total, page.per_page),
    }))
}

async fn get_order(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<AccountOrderWithItems>, AppError> {
    let customer = current.customer;
    let mut conn = db::get_db_connection(&app_state)?;
    customer_crud::get_order(&mut conn, customer.id, order_id)?
        .map(Json)
        .ok_or_else(|| AppError::NotFound("Order not found".to_string()))
}

/// Everything stored about the customer, as a JSON download (GDPR art. 15
/// and 20).
async fn export(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    headers: HeaderMap,
    Json(request): Json<CurrentPasswordRequest>,
) -> Result<impl IntoResponse, AppError> {
    confirm_identity(&app_state, &headers, &current, request.current_password).await?;
    let current_for_export = current.clone();
    let customer = current.customer;
    let mut conn = db::get_db_connection(&app_state)?;
    let export = AccountExport {
        exported_at: chrono::Utc::now(),
        profile: profile(&app_state, &current_for_export)?,
        email_verified_at: customer.email_verified_at,
        sign_in_providers: customer_crud::identity_linked_at(
            &mut conn,
            customer.id,
            customer_crud::GOOGLE,
        )?
        .map(|linked_at| IdentityExport {
            provider: customer_crud::GOOGLE,
            linked_at,
        })
        .into_iter()
        .collect(),
        newsletter: newsletter::export_subscription(&mut conn, &customer.email)?,
        orders: customer_crud::all_orders(&mut conn, customer.id)?,
    };
    Ok((
        AppendHeaders([(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"miedaria-paunilor-account.json\"",
        )]),
        Json(export),
    ))
}

/// Erases the account, its sessions and tokens. Orders stay for bookkeeping,
/// detached from any account.
async fn delete_account(
    State(app_state): State<Arc<AppState>>,
    Extension(current): Extension<CurrentCustomer>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(request): Json<CurrentPasswordRequest>,
) -> Result<(CookieJar, StatusCode), AppError> {
    confirm_identity(&app_state, &headers, &current, request.current_password).await?;
    let customer = current.customer;
    let mut conn = db::get_db_connection(&app_state)?;
    customer_crud::delete(&mut conn, customer.id)?;
    account::send(&app_state, &customer, AccountEmail::AccountDeleted);
    Ok((
        jar.add(account::clear_session_cookie()),
        StatusCode::NO_CONTENT,
    ))
}

/// Routes mounted at `/api/account/...`.
pub fn router(app_state: Arc<AppState>) -> Router<Arc<AppState>> {
    let authenticated = Router::new()
        .route("/api/account/logout-all", post(logout_everywhere))
        .route("/api/account/email", post(change_email))
        .route("/api/account/password", post(change_password))
        .route("/api/account/orders", get(list_orders))
        .route("/api/account/orders/{order_id}", get(get_order))
        .route("/api/account/export", post(export))
        .route("/api/account", axum::routing::delete(delete_account))
        .merge(account_google::authenticated_router())
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            account::require_customer,
        ));

    Router::new()
        .route("/api/account/register", post(register))
        .route("/api/account/password-reset", post(request_password_reset))
        .route("/api/account/set-password", post(set_password))
        .route("/api/account/login", post(login))
        .route("/api/account/logout", post(logout))
        .route("/api/account/me", get(me))
        .route("/api/account/email/confirm", post(confirm_email_change))
        .merge(account_google::public_router())
        .merge(authenticated)
        .route_layer(axum::middleware::from_fn_with_state(
            app_state,
            account::same_origin_only,
        ))
}
