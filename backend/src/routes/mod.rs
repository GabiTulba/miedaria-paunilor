pub mod blog;
pub mod checkout;
pub mod image;
pub mod lot;
pub mod misc;
pub mod product;

use axum::response::AppendHeaders;

pub(crate) type VaryLang = AppendHeaders<[(axum::http::HeaderName, &'static str); 1]>;

pub(crate) fn vary_accept_language() -> VaryLang {
    AppendHeaders([(axum::http::header::VARY, "Accept-Language")])
}
