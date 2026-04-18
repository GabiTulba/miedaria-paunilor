use axum::extract::FromRequestParts;
use axum::http::request::Parts;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    En,
    Ro,
}

impl Default for Language {
    fn default() -> Self {
        Language::En
    }
}

impl Language {
    fn from_accept_language(header: Option<&str>) -> Self {
        match header {
            Some(h) => {
                for part in h.split(',') {
                    let tag = part.split(';').next().unwrap_or("").trim().to_lowercase();
                    if tag.starts_with("ro") {
                        return Language::Ro;
                    }
                    if tag.starts_with("en") {
                        return Language::En;
                    }
                }
                Language::En
            }
            None => Language::En,
        }
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Language {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("Accept-Language")
            .and_then(|v| v.to_str().ok());
        Ok(Language::from_accept_language(header))
    }
}
