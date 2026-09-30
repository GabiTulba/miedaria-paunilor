//! The login in front of a `MODE=dev` site. nginx asks `check` before
//! serving any request (`auth_request`), passing the original path in
//! `X-Original-URI`, and answers a refusal with the login page, which returns
//! the visitor to where they started. Mounted only in dev mode.

use std::sync::Arc;

use axum::{
    Form, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::{Html, IntoResponse, Redirect, Response},
    routing::get,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Deserialize;

use crate::AppState;
use crate::auth::extract_client_ip;
use crate::mailer::escape_html;
use crate::site_mode::{DevAccess, SiteMode};

const MAX_NEXT_LEN: usize = 2048;
/// Reached without a browser: Stripe's webhook (authenticated by its
/// signature), the container healthcheck, and the login form itself.
const OPEN_PATHS: [&str; 3] = ["/api/webhooks/stripe", "/health", "/api/dev-access/login"];

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/dev-access/check", get(check))
        .route("/api/dev-access/login", get(page).post(login))
}

fn dev_access(app_state: &AppState) -> Option<&DevAccess> {
    match &app_state.site_mode {
        SiteMode::Dev(access) => Some(access),
        SiteMode::Prod => None,
    }
}

fn original_path(headers: &HeaderMap) -> &str {
    headers
        .get("X-Original-URI")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("/")
}

async fn check(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    jar: CookieJar,
) -> StatusCode {
    let path = original_path(&headers)
        .split('?')
        .next()
        .unwrap_or_default();
    match dev_access(&app_state) {
        Some(_) if OPEN_PATHS.contains(&path) => StatusCode::NO_CONTENT,
        Some(access) if access.accepts_cookie(&jar) => StatusCode::NO_CONTENT,
        _ => StatusCode::UNAUTHORIZED,
    }
}

/// A path on this site to return to; anything else (another host, or the
/// login itself) returns to the home page.
fn safe_next(next: &str) -> &str {
    let is_local_path = next.starts_with('/')
        && !next.starts_with("//")
        && !next.starts_with("/api/dev-access/")
        && next.len() <= MAX_NEXT_LEN
        && !next.chars().any(|c| c == '\\' || c.is_control());
    if is_local_path { next } else { "/" }
}

enum Notice {
    None,
    WrongCredentials,
    TooManyAttempts,
}

fn login_page(status: StatusCode, next: &str, notice: Notice) -> Response {
    let notice = match notice {
        Notice::None => "",
        Notice::WrongCredentials => {
            r#"<p class="error" role="alert">Date greșite. / Wrong username or password.</p>"#
        }
        Notice::TooManyAttempts => {
            r#"<p class="error" role="alert">Prea multe încercări, reveniți peste un minut. / Too many attempts, try again in a minute.</p>"#
        }
    };
    let next = escape_html(safe_next(next));
    let html = format!(
        r#"<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Miedăria Păunilor · dev</title>
<style>
body {{ font-family: system-ui, sans-serif; background: #f4f1ea; color: #222; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 16px; box-sizing: border-box; }}
form {{ background: #fff; padding: 24px; border-radius: 8px; width: 100%; max-width: 340px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }}
h1 {{ font-size: 1.2rem; margin: 0 0 8px; }}
p {{ font-size: .9rem; }}
label {{ display: block; margin: 12px 0 4px; font-size: .9rem; }}
input {{ width: 100%; box-sizing: border-box; padding: 10px; font-size: 1rem; border: 1px solid #bbb; border-radius: 4px; }}
button {{ margin-top: 16px; width: 100%; padding: 12px; font-size: 1rem; border: 0; border-radius: 4px; background: #1f3a5f; color: #fff; cursor: pointer; }}
.error {{ color: #a40000; }}
@media (prefers-color-scheme: dark) {{ body {{ background: #1b1b1b; color: #eee; }} form {{ background: #2a2a2a; }} input {{ background: #1b1b1b; color: #eee; border-color: #555; }} }}
</style>
</head>
<body>
<form method="post" action="/api/dev-access/login">
<h1>Site de test / Test site</h1>
<p>Acces restricționat. / Restricted access.</p>
{notice}
<input type="hidden" name="next" value="{next}">
<label for="username">Utilizator / Username</label>
<input id="username" name="username" autocomplete="username" required autofocus>
<label for="password">Parolă / Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Intră / Sign in</button>
</form>
</body>
</html>"#
    );
    (
        status,
        [
            (header::CACHE_CONTROL, "no-store"),
            (
                header::HeaderName::from_static("x-robots-tag"),
                "noindex, nofollow",
            ),
        ],
        Html(html),
    )
        .into_response()
}

async fn page(headers: HeaderMap) -> Response {
    login_page(
        StatusCode::UNAUTHORIZED,
        original_path(&headers),
        Notice::None,
    )
}

#[derive(Deserialize)]
struct LoginForm {
    username: String,
    password: String,
    #[serde(default)]
    next: String,
}

async fn login(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    jar: CookieJar,
    Form(form): Form<LoginForm>,
) -> Response {
    let Some(access) = dev_access(&app_state) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let client_ip = extract_client_ip(&headers);
    if app_state.dev_access_limiter.check_key(&client_ip).is_err() {
        return login_page(
            StatusCode::TOO_MANY_REQUESTS,
            &form.next,
            Notice::TooManyAttempts,
        );
    }
    if !access.accepts(&form.username, &form.password) {
        tracing::warn!(ip = %client_ip, "dev site login failed");
        return login_page(
            StatusCode::UNAUTHORIZED,
            &form.next,
            Notice::WrongCredentials,
        );
    }
    (
        jar.add(access.cookie()),
        Redirect::to(safe_next(&form.next)),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_stays_on_this_site() {
        assert_eq!(safe_next("/ro/shop?sort=price"), "/ro/shop?sort=price");
        assert_eq!(safe_next("//evil.example"), "/");
        assert_eq!(safe_next("https://evil.example"), "/");
        assert_eq!(safe_next("/\\evil.example"), "/");
        assert_eq!(safe_next("/api/dev-access/login"), "/");
        assert_eq!(safe_next(""), "/");
    }
}
