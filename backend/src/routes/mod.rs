pub mod account;
pub mod account_google;
pub mod analytics;
pub mod blog;
pub mod checkout;
pub mod dev_access;
pub mod image;
pub mod labels;
pub mod lot;
pub mod misc;
pub mod newsletter;
pub mod product;
pub mod shipping;

use axum::response::AppendHeaders;

pub(crate) type VaryLang = AppendHeaders<[(axum::http::HeaderName, &'static str); 1]>;

pub(crate) fn vary_accept_language() -> VaryLang {
    AppendHeaders([(axum::http::header::VARY, "Accept-Language")])
}
