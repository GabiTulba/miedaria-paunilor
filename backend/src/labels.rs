//! Client of the label renderer (`labels/`, an internal service built on the
//! artwork repository). Requests and responses are typed here, so only
//! well-formed JSON reaches the renderer and only well-formed answers reach
//! the admin; the renderer validates the content itself (lengths, formats,
//! glyphs, EAN check digit) and checks that it fits and is legible at each
//! label size.

use std::time::Duration;

use axum::body::Bytes;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::{Json, http::header};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use ts_rs::TS;

use crate::AppError;

const PREVIEW_TIMEOUT: Duration = Duration::from_secs(30);
/// Every size of both sides, with their PDF sheets, takes about 15 s on one
/// core; nginx waits 180 s for `/api/admin/labels/`.
const BUNDLE_TIMEOUT: Duration = Duration::from_secs(150);

/// One bottle format: its front and back label sizes in mm.
#[derive(Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct LabelSize {
    pub name: String,
    pub front_mm: (u32, u32),
    pub back_mm: (u32, u32),
    pub bottle: String,
    pub volume_cl: u32,
}

/// The front label's text: the optional small pre-title ("Mied cu"), the
/// variant name on one or two lines on a stripe of `stripe_color`, the
/// sweetness line with the optional effervescence after it ("Demidulce ·
/// Ușor Spumant"), the bottling date, and the ABV and volume in the bottom
/// corners. `volume_cl` `None` prints each size's bottle volume. `medal` is
/// an award medal's picture, a base64 PNG the renderer checks, re-encodes
/// and places in the top-right corner.
#[derive(Serialize, Deserialize, Debug, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct FrontLabelContent {
    pub medal: Option<String>,
    pub pre_title: Option<String>,
    pub variant_lines: Vec<String>,
    pub sweetness: String,
    pub effervescence: Option<String>,
    pub stripe_color: String,
    pub bottling_date: String,
    pub alcohol_percent: String,
    pub volume_cl: Option<String>,
}

/// The back label's mandatory particulars. `volume_ml` `None` prints each
/// size's bottle volume.
#[derive(Serialize, Deserialize, Debug, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct BackLabelContent {
    pub producer_name: String,
    pub address_lines: Vec<String>,
    pub lot_code: String,
    pub ean: String,
    pub qr_url: String,
    pub alcohol_percent: String,
    pub volume_ml: Option<String>,
    pub contains_sulfites: bool,
}

#[derive(Serialize, Deserialize, Debug, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct LabelPreviewRequest {
    pub size: String,
    pub front: Option<FrontLabelContent>,
    pub back: Option<BackLabelContent>,
}

#[derive(Serialize, Deserialize, Debug, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct LabelBundleRequest {
    pub sizes: Vec<String>,
    pub front: Option<FrontLabelContent>,
    pub back: Option<BackLabelContent>,
}

#[derive(Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct IllegibleMeasure {
    pub measure: String,
    pub printed_mm: f64,
    pub minimum_mm: f64,
}

/// Why the renderer refused: a field it can't use (`field` is its dotted
/// path, e.g. `back.ean`), or valid content that is too wide or tall for a
/// label size or prints below a minimum text size there.
#[derive(Serialize, Deserialize, Debug, TS)]
#[serde(tag = "code", rename_all = "snake_case")]
#[ts(export)]
pub enum LabelError {
    InvalidField {
        field: String,
        problem: String,
        detail: Option<String>,
    },
    DoesNotFit {
        side: String,
        size: String,
        detail: String,
    },
    Illegible {
        side: String,
        size: String,
        detail: Vec<IllegibleMeasure>,
    },
}

/// One side's preview: its finished-look SVG and the voluntary extras left
/// off for lack of room, or why it can't be made at that size.
#[derive(Serialize, Deserialize, Debug, TS)]
#[serde(untagged)]
#[ts(export)]
pub enum LabelPreviewSide {
    Rendered { svg: String, dropped: Vec<String> },
    Failed { error: LabelError },
}

#[derive(Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct LabelPreview {
    pub front: Option<LabelPreviewSide>,
    pub back: Option<LabelPreviewSide>,
}

#[derive(Debug)]
pub enum LabelsFailure {
    /// 422 with the renderer's reason.
    Rejected(LabelError),
    /// The renderer is down or answered something unexpected (logged).
    Unavailable,
}

impl IntoResponse for LabelsFailure {
    fn into_response(self) -> Response {
        match self {
            LabelsFailure::Rejected(error) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(error)).into_response()
            }
            LabelsFailure::Unavailable => {
                AppError::ServiceUnavailable("The label renderer is unavailable".to_string())
                    .into_response()
            }
        }
    }
}

pub struct LabelsClient {
    base_url: String,
    http: reqwest::Client,
}

impl LabelsClient {
    pub fn new(base_url: &str) -> Result<Self, String> {
        if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
            return Err("LABELS_URL must be an http:// or https:// URL".to_string());
        }
        let http = reqwest::Client::builder()
            .user_agent("miedaria-paunilor-backend")
            .build()
            .map_err(|e| format!("cannot build HTTP client for the label renderer: {e}"))?;
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            http,
        })
    }

    pub async fn sizes(&self) -> Result<Vec<LabelSize>, LabelsFailure> {
        let response = self
            .http
            .get(format!("{}/sizes", self.base_url))
            .timeout(PREVIEW_TIMEOUT)
            .send()
            .await
            .map_err(unavailable)?;
        json(accepted(response).await?).await
    }

    pub async fn preview(
        &self,
        request: &LabelPreviewRequest,
    ) -> Result<LabelPreview, LabelsFailure> {
        json(self.post("/preview", request, PREVIEW_TIMEOUT).await?).await
    }

    /// A ZIP of every label, print layer and A4 sheet (SVG and PDF).
    pub async fn bundle(&self, request: &LabelBundleRequest) -> Result<Bytes, LabelsFailure> {
        self.post("/bundle", request, BUNDLE_TIMEOUT)
            .await?
            .bytes()
            .await
            .map_err(unavailable)
    }

    async fn post(
        &self,
        path: &str,
        body: &impl Serialize,
        timeout: Duration,
    ) -> Result<reqwest::Response, LabelsFailure> {
        let response = self
            .http
            .post(format!("{}{path}", self.base_url))
            .header(header::CONTENT_TYPE, "application/json")
            .json(body)
            .timeout(timeout)
            .send()
            .await
            .map_err(unavailable)?;
        accepted(response).await
    }
}

/// `response` if it succeeded; its reason if the renderer refused the
/// content.
async fn accepted(response: reqwest::Response) -> Result<reqwest::Response, LabelsFailure> {
    match response.status() {
        status if status.is_success() => Ok(response),
        StatusCode::UNPROCESSABLE_ENTITY => Err(LabelsFailure::Rejected(json(response).await?)),
        status => {
            tracing::error!(%status, "label renderer failed");
            Err(LabelsFailure::Unavailable)
        }
    }
}

async fn json<T: DeserializeOwned>(response: reqwest::Response) -> Result<T, LabelsFailure> {
    response.json().await.map_err(unavailable)
}

fn unavailable(e: reqwest::Error) -> LabelsFailure {
    tracing::error!(error = %e, "label renderer unreachable or invalid answer");
    LabelsFailure::Unavailable
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_renderers_answers() {
        let preview: LabelPreview = serde_json::from_value(serde_json::json!({
            "front": {"error": {"code": "does_not_fit", "side": "front", "size": "90x120",
                                "detail": "the variant line 1 'X' is too wide for the 90x120 label"}},
            "back": {"svg": "<svg/>", "dropped": ["brand line", "QR code"]},
        }))
        .unwrap();
        assert!(matches!(
            preview.front,
            Some(LabelPreviewSide::Failed {
                error: LabelError::DoesNotFit { .. }
            })
        ));
        assert!(
            matches!(preview.back, Some(LabelPreviewSide::Rendered { ref dropped, .. }) if dropped.len() == 2)
        );

        let invalid: LabelError = serde_json::from_value(serde_json::json!({
            "code": "invalid_field", "field": "back.ean", "problem": "check_digit", "detail": null,
        }))
        .unwrap();
        assert!(
            matches!(invalid, LabelError::InvalidField { ref field, .. } if field == "back.ean")
        );

        let illegible: LabelError = serde_json::from_value(serde_json::json!({
            "code": "illegible", "side": "back", "size": "50x70",
            "detail": [{"measure": "volume: capitals/figures", "printed_mm": 3.9, "minimum_mm": 4.0}],
        }))
        .unwrap();
        assert!(matches!(illegible, LabelError::Illegible { ref detail, .. } if detail.len() == 1));

        let sizes: Vec<LabelSize> = serde_json::from_value(serde_json::json!([
            {"name": "90x120", "front_mm": [90, 120], "back_mm": [80, 105], "bottle": "75 cl bottle", "volume_cl": 75},
        ]))
        .unwrap();
        assert_eq!(sizes[0].back_mm, (80, 105));
    }

    #[test]
    fn rejects_unknown_request_fields() {
        let request =
            serde_json::json!({"size": "90x120", "front": null, "back": null, "extra": 1});
        assert!(serde_json::from_value::<LabelPreviewRequest>(request).is_err());
    }
}
