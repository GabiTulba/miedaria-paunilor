//! Customer accounts: password policy, the session cookie and its middleware,
//! the same-origin guard, account emails and the hourly cleanup. Entirely
//! separate from admin authentication (`auth.rs`).

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use axum::{
    extract::{Request, State},
    http::{HeaderMap, Method, header},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use lettre::Address;
use serde::Serialize;
use ts_rs::TS;

use crate::AppError;
use crate::AppState;
use crate::customer_crud;
use crate::db;
use crate::language::Language;
use crate::mailer::{Action, Email, escape_html, html_layout};
use crate::metrics::{self, Task};
use crate::models::Customer;
use crate::utils::{hash_password, verify_password};

/// `__Host-` binds the cookie to this exact host over HTTPS with `Path=/`, so
/// neither a subdomain nor plain HTTP can set or overwrite it.
pub const SESSION_COOKIE: &str = "__Host-customer_session";
const MIN_PASSWORD_CHARS: usize = 10;
const MAX_PASSWORD_CHARS: usize = 128;
/// Accounts without a password confirm sensitive actions by signing in with
/// Google again; the new session counts for this long.
const REAUTH_WINDOW: chrono::Duration = chrono::Duration::minutes(10);
const CLEANUP_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60 * 60);

/// The 10,000 most common passwords of 10+ characters (SecLists xato-net
/// corpus), lowercased.
static COMMON_PASSWORDS: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| include_str!("common_passwords.txt").lines().collect());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum PasswordProblem {
    TooShort,
    TooLong,
    Common,
    ContainsEmail,
}

/// NIST SP 800-63B: a length floor and a blocklist, no composition rules.
pub fn check_password(password: &str, email: &str) -> Result<(), PasswordProblem> {
    let chars = password.chars().count();
    if chars < MIN_PASSWORD_CHARS {
        return Err(PasswordProblem::TooShort);
    }
    if chars > MAX_PASSWORD_CHARS {
        return Err(PasswordProblem::TooLong);
    }
    let lowered = password.to_lowercase();
    if COMMON_PASSWORDS.contains(lowered.as_str()) {
        return Err(PasswordProblem::Common);
    }
    let local_part = email.split('@').next().unwrap_or_default();
    if local_part.chars().count() >= 3 && lowered.contains(local_part) {
        return Err(PasswordProblem::ContainsEmail);
    }
    Ok(())
}

/// Argon2 is deliberately slow, so it runs off the async workers.
pub async fn hash_password_blocking(password: String) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|e| AppError::InternalServerError(format!("hashing task failed: {e}")))?
        .map_err(|e| AppError::InternalServerError(format!("password hashing failed: {e}")))
}

pub async fn verify_password_blocking(password: String, hash: String) -> bool {
    tokio::task::spawn_blocking(move || verify_password(&password, &hash))
        .await
        .unwrap_or(false)
}

pub fn session_cookie(token: String) -> Cookie<'static> {
    Cookie::build((SESSION_COOKIE, token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::seconds(
            customer_crud::SESSION_LIFETIME.num_seconds(),
        ))
        .build()
}

pub fn clear_session_cookie() -> Cookie<'static> {
    Cookie::build((SESSION_COOKIE, ""))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::ZERO)
        .build()
}

pub fn session_token(jar: &CookieJar) -> Option<String> {
    jar.get(SESSION_COOKIE).map(|c| c.value().to_string())
}

/// The logged-in customer and when their session was signed in, placed in
/// request extensions by `require_customer`.
#[derive(Clone)]
pub struct CurrentCustomer {
    pub customer: Customer,
    pub signed_in_at: chrono::DateTime<chrono::Utc>,
}

impl CurrentCustomer {
    /// Whether the session was signed in recently enough to stand in for a
    /// password on an account that has none.
    pub fn recently_signed_in(&self) -> bool {
        self.reauthenticated_until() > chrono::Utc::now()
    }

    pub fn reauthenticated_until(&self) -> chrono::DateTime<chrono::Utc> {
        self.signed_in_at + REAUTH_WINDOW
    }
}

/// The logged-in customer, if the request carries a live session.
pub fn current_customer(
    app_state: &Arc<AppState>,
    jar: &CookieJar,
) -> Result<Option<CurrentCustomer>, AppError> {
    let Some(token) = session_token(jar) else {
        return Ok(None);
    };
    let mut conn = db::get_db_connection(app_state)?;
    let Some(session) = customer_crud::session(&mut conn, &token)? else {
        return Ok(None);
    };
    Ok(Some(CurrentCustomer {
        customer: customer_crud::get(&mut conn, session.customer_id)?,
        signed_in_at: session.signed_in_at,
    }))
}

pub async fn require_customer(
    State(app_state): State<Arc<AppState>>,
    jar: CookieJar,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let current = current_customer(&app_state, &jar)?
        .ok_or_else(|| AppError::Unauthorized("Not logged in".to_string()))?;
    req.extensions_mut().insert(current);
    Ok(next.run(req).await)
}

/// Rejects state-changing requests a browser sent from another site. The
/// session cookie is already `SameSite=Strict`; this is defence in depth
/// against a sibling-site or same-site-but-cross-origin attacker. Requests
/// without these headers do not come from a browser, so carry no victim's
/// cookie.
pub async fn same_origin_only(
    State(app_state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    if !is_same_origin(req.method(), req.headers(), &app_state.site_url) {
        return Err(AppError::Forbidden(
            "Cross-origin request rejected".to_string(),
        ));
    }
    Ok(next.run(req).await)
}

fn is_same_origin(method: &Method, headers: &HeaderMap, site_url: &str) -> bool {
    if matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS) {
        return true;
    }
    let header_is = |name: &str, allowed: &str| {
        headers
            .get(name)
            .is_none_or(|v| v.to_str().is_ok_and(|v| v == allowed))
    };
    header_is(header::ORIGIN.as_str(), site_url) && header_is("sec-fetch-site", "same-origin")
}

/// Hourly purge of expired sessions and tokens, and of registrations whose
/// link expired unused. Also forgets idle rate-limiter keys.
pub async fn run_cleanup_task(app_state: Arc<AppState>) {
    let mut interval = tokio::time::interval(CLEANUP_INTERVAL);
    loop {
        interval.tick().await;
        let result = tokio::task::spawn_blocking({
            let app_state = app_state.clone();
            move || {
                let mut conn = db::get_db_connection(&app_state)?;
                customer_crud::purge_expired(&mut conn).map_err(AppError::from)
            }
        })
        .await;
        match result {
            Ok(Ok(0)) => {}
            Ok(Ok(purged)) => tracing::info!(purged, "purged unfinished registrations"),
            Ok(Err(e)) => {
                tracing::error!(error = ?e, "account cleanup failed");
                metrics::record_failure(Task::account_purge);
            }
            Err(e) => {
                tracing::error!(error = %e, "account cleanup task panicked");
                metrics::record_failure(Task::account_purge);
            }
        }
        for limiter in [
            &app_state.account_limiter,
            &app_state.customer_login_limiter,
        ] {
            limiter.retain_recent();
            limiter.shrink_to_fit();
        }
        app_state.customer_password_limiter.retain_recent();
        app_state.customer_password_limiter.shrink_to_fit();
    }
}

/// The account emails; each is sent in the account's language.
pub enum AccountEmail<'a> {
    /// Finish registering by choosing a password.
    Registration {
        token: &'a str,
    },
    /// Someone tried to register an address that already has an account.
    AlreadyRegistered {
        token: &'a str,
    },
    PasswordReset {
        token: &'a str,
    },
    /// Sent to the new address; the link completes the change.
    ConfirmEmailChange {
        token: &'a str,
    },
    /// Sent to the old address when a change is requested.
    EmailChangeRequested {
        new_email: &'a str,
    },
    PasswordChanged,
    GoogleLinked,
    GoogleUnlinked,
    AccountDeleted,
}

struct Texts {
    subject: &'static str,
    heading: &'static str,
    paragraphs: Vec<String>,
    button: Option<(&'static str, String)>,
    footer: &'static str,
}

impl AccountEmail<'_> {
    pub fn build(&self, site_url: &str, lang: Language, to: Address) -> Email {
        let texts = self.texts(site_url, lang);
        let text_body = std::iter::once(texts.heading.to_string())
            .chain(texts.paragraphs.iter().cloned())
            .chain(
                texts
                    .button
                    .as_ref()
                    .map(|(label, url)| format!("{label}: {url}")),
            )
            .chain(std::iter::once(texts.footer.to_string()))
            .collect::<Vec<_>>()
            .join("\n\n");
        let paragraphs: Vec<String> = texts.paragraphs.iter().map(|p| escape_html(p)).collect();
        let action = texts
            .button
            .as_ref()
            .map(|(label, url)| Action { label, url });
        Email {
            to,
            subject: texts.subject.to_string(),
            text: text_body + "\n",
            html: html_layout(
                lang,
                texts.heading,
                &paragraphs,
                action.as_ref(),
                &escape_html(texts.footer),
            ),
            list_unsubscribe: None,
        }
    }

    fn texts(&self, site_url: &str, lang: Language) -> Texts {
        let page = |path: &str| format!("{site_url}/{}/account/{path}", lang.code());
        let set_password = |token: &str| page(&format!("set-password?token={token}"));
        let ro = lang == Language::Ro;
        let not_you = if ro {
            "Dacă nu tu ai făcut cererea, ignoră acest mesaj; contul tău nu se schimbă."
        } else {
            "If this wasn't you, just ignore this email; nothing changes on your account."
        };
        let secure_it = if ro {
            "Dacă nu tu ai făcut această modificare, resetează-ți imediat parola și scrie-ne."
        } else {
            "If you didn't make this change, reset your password straight away and let us know."
        };
        match *self {
            AccountEmail::Registration { token } => Texts {
                subject: if ro { "Finalizează crearea contului" } else { "Finish creating your account" },
                heading: if ro { "Alege o parolă" } else { "Choose a password" },
                paragraphs: vec![
                    (if ro {
                        "Cineva (sperăm că tu) a cerut un cont la Miedăria Păunilor pentru această adresă. Alege o parolă ca să-l activezi; comenzile plasate anterior cu această adresă vor apărea în cont."
                    } else {
                        "Someone (hopefully you) asked for a Miedăria Păunilor account for this address. Choose a password to activate it; orders you placed earlier with this address will show up in it."
                    })
                    .to_string(),
                    (if ro { "Linkul este valabil 24 de ore." } else { "The link is valid for 24 hours." }).to_string(),
                ],
                button: Some((if ro { "Alege parola" } else { "Choose password" }, set_password(token))),
                footer: if ro {
                    "Dacă nu tu ai făcut cererea, ignoră acest mesaj: fără parolă contul nu se creează, iar adresa se șterge."
                } else {
                    "If this wasn't you, just ignore this email: without a password no account is created and the address is deleted."
                },
            },
            AccountEmail::AlreadyRegistered { token } => Texts {
                subject: if ro { "Ai deja un cont" } else { "You already have an account" },
                heading: if ro { "Ai deja un cont" } else { "You already have an account" },
                paragraphs: vec![
                    (if ro {
                        "Cineva a încercat să creeze un cont nou cu această adresă, dar ea are deja un cont. Te poți autentifica oricând; dacă ți-ai uitat parola, alege una nouă mai jos."
                    } else {
                        "Someone tried to create a new account with this address, but it already has one. You can log in any time; if you forgot your password, choose a new one below."
                    })
                    .to_string(),
                    (if ro { "Linkul este valabil o oră." } else { "The link is valid for one hour." }).to_string(),
                ],
                button: Some((if ro { "Alege o parolă nouă" } else { "Choose a new password" }, set_password(token))),
                footer: not_you,
            },
            AccountEmail::PasswordReset { token } => Texts {
                subject: if ro { "Resetarea parolei" } else { "Reset your password" },
                heading: if ro { "Alege o parolă nouă" } else { "Choose a new password" },
                paragraphs: vec![
                    (if ro {
                        "Am primit o cerere de resetare a parolei contului tău. După schimbare vei fi deconectat de pe toate dispozitivele."
                    } else {
                        "We received a request to reset your account password. Changing it logs you out on every device."
                    })
                    .to_string(),
                    (if ro { "Linkul este valabil o oră." } else { "The link is valid for one hour." }).to_string(),
                ],
                button: Some((if ro { "Alege parola" } else { "Choose password" }, set_password(token))),
                footer: not_you,
            },
            AccountEmail::ConfirmEmailChange { token } => Texts {
                subject: if ro { "Confirmă noua adresă de email" } else { "Confirm your new email address" },
                heading: if ro { "Confirmă noua adresă" } else { "Confirm your new address" },
                paragraphs: vec![
                    (if ro {
                        "Contul tău de la Miedăria Păunilor va folosi această adresă după ce confirmi."
                    } else {
                        "Your Miedăria Păunilor account will use this address once you confirm."
                    })
                    .to_string(),
                    (if ro { "Linkul este valabil 24 de ore." } else { "The link is valid for 24 hours." }).to_string(),
                ],
                button: Some((
                    if ro { "Confirmă adresa" } else { "Confirm address" },
                    page(&format!("email/confirm?token={token}")),
                )),
                footer: not_you,
            },
            AccountEmail::EmailChangeRequested { new_email } => Texts {
                subject: if ro { "Schimbarea adresei de email" } else { "Email address change requested" },
                heading: if ro { "Schimbarea adresei de email" } else { "Email address change requested" },
                paragraphs: vec![if ro {
                    format!("S-a cerut mutarea contului tău pe adresa {new_email}. Schimbarea are loc doar după confirmarea din mesajul trimis acolo.")
                } else {
                    format!("A request was made to move your account to {new_email}. It only happens once confirmed from the email sent there.")
                }],
                button: Some((if ro { "Resetează parola" } else { "Reset password" }, page("forgot-password"))),
                footer: secure_it,
            },
            AccountEmail::PasswordChanged => Texts {
                subject: if ro { "Parola a fost schimbată" } else { "Your password was changed" },
                heading: if ro { "Parola a fost schimbată" } else { "Your password was changed" },
                paragraphs: vec![(if ro {
                    "Parola contului tău tocmai a fost schimbată, iar celelalte dispozitive au fost deconectate."
                } else {
                    "Your account password was just changed, and your other devices were logged out."
                })
                .to_string()],
                button: Some((if ro { "Resetează parola" } else { "Reset password" }, page("forgot-password"))),
                footer: secure_it,
            },
            AccountEmail::GoogleLinked => Texts {
                subject: if ro { "Conectare cu Google activată" } else { "Google sign-in connected" },
                heading: if ro { "Conectare cu Google activată" } else { "Google sign-in connected" },
                paragraphs: vec![(if ro {
                    "Un cont Google a fost legat de contul tău și poate fi folosit acum pentru autentificare."
                } else {
                    "A Google account was connected to your account and can now be used to log in."
                })
                .to_string()],
                button: Some((if ro { "Setările contului" } else { "Account settings" }, page("settings"))),
                footer: secure_it,
            },
            AccountEmail::GoogleUnlinked => Texts {
                subject: if ro { "Conectare cu Google dezactivată" } else { "Google sign-in disconnected" },
                heading: if ro { "Conectare cu Google dezactivată" } else { "Google sign-in disconnected" },
                paragraphs: vec![(if ro {
                    "Contul Google a fost deconectat de la contul tău; de acum te autentifici cu parola."
                } else {
                    "The Google account was disconnected from your account; you now log in with your password."
                })
                .to_string()],
                button: Some((if ro { "Resetează parola" } else { "Reset password" }, page("forgot-password"))),
                footer: secure_it,
            },
            AccountEmail::AccountDeleted => Texts {
                subject: if ro { "Contul a fost șters" } else { "Your account was deleted" },
                heading: if ro { "Contul a fost șters" } else { "Your account was deleted" },
                paragraphs: vec![(if ro {
                    "Contul tău și datele lui au fost șterse. Comenzile plasate rămân în evidențele noastre contabile pe durata impusă de lege, fără legătură cu vreun cont."
                } else {
                    "Your account and its data were deleted. Orders you placed stay in our accounting records for the period the law requires, no longer tied to any account."
                })
                .to_string()],
                button: None,
                footer: if ro {
                    "Dacă nu tu ai cerut ștergerea, scrie-ne cât mai curând."
                } else {
                    "If you didn't ask for this, please contact us as soon as possible."
                },
            },
        }
    }
}

/// Sends an account email to `customer` in their language.
pub fn send(app_state: &AppState, customer: &Customer, email: AccountEmail) {
    send_to(
        app_state,
        &customer.email,
        Language::from_code(&customer.language),
        email,
    );
}

pub fn send_to(app_state: &AppState, address: &str, lang: Language, email: AccountEmail) {
    match address.parse::<Address>() {
        Ok(to) => app_state
            .mailer
            .send_in_background(email.build(&app_state.site_url, lang, to)),
        Err(_) => tracing::error!("stored customer address does not parse"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_policy() {
        let email = "ana.pop@example.ro";
        assert_eq!(
            check_password("short", email),
            Err(PasswordProblem::TooShort)
        );
        assert_eq!(
            check_password(&"x".repeat(129), email),
            Err(PasswordProblem::TooLong)
        );
        assert_eq!(
            check_password("QwertyUiop", email),
            Err(PasswordProblem::Common)
        );
        assert_eq!(
            check_password("my-ana.pop-2026", email),
            Err(PasswordProblem::ContainsEmail)
        );
        assert_eq!(check_password("hidromel cu tei 2026", email), Ok(()));
        // Length counts characters, not bytes.
        assert_eq!(check_password("ăâîșțăâîșț", email), Ok(()));
    }

    #[test]
    fn same_origin_guard() {
        let site = "https://miedaria-paunilor.ro";
        let headers = |pairs: &[(&'static str, &str)]| {
            let mut h = HeaderMap::new();
            for (k, v) in pairs {
                h.insert(*k, v.parse().unwrap());
            }
            h
        };
        let post = Method::POST;
        assert!(is_same_origin(
            &post,
            &headers(&[("origin", site), ("sec-fetch-site", "same-origin")]),
            site
        ));
        assert!(is_same_origin(&post, &headers(&[]), site));
        assert!(!is_same_origin(
            &post,
            &headers(&[("origin", "https://evil.test")]),
            site
        ));
        assert!(!is_same_origin(
            &post,
            &headers(&[("sec-fetch-site", "same-site")]),
            site
        ));
        assert!(is_same_origin(
            &Method::GET,
            &headers(&[("origin", "https://evil.test")]),
            site
        ));
    }
}
