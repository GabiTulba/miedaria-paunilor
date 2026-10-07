use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::header,
    response::IntoResponse,
    routing::{get, post},
};

use crate::AppState;
use crate::labels::{
    LabelBundleRequest, LabelPreview, LabelPreviewRequest, LabelSize, LabelsFailure,
};

async fn sizes(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<LabelSize>>, LabelsFailure> {
    app_state.labels.sizes().await.map(Json)
}

async fn preview(
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<LabelPreviewRequest>,
) -> Result<Json<LabelPreview>, LabelsFailure> {
    app_state.labels.preview(&request).await.map(Json)
}

async fn bundle(
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<LabelBundleRequest>,
) -> Result<impl IntoResponse, LabelsFailure> {
    let archive = app_state.labels.bundle(&request).await?;
    Ok((
        [
            (header::CONTENT_TYPE, "application/zip"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"labels.zip\"",
            ),
        ],
        archive,
    ))
}

/// Room for a medal picture (base64 PNG, at most 2 MB decoded, which the
/// renderer enforces) besides the label text.
const LABEL_BODY_LIMIT: usize = 3 * 1024 * 1024;

/// Routes mounted under `/api/admin/...`.
pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/labels/sizes", get(sizes))
        .route(
            "/labels/preview",
            post(preview).layer(DefaultBodyLimit::max(LABEL_BODY_LIMIT)),
        )
        .route(
            "/labels/bundle",
            post(bundle).layer(DefaultBodyLimit::max(LABEL_BODY_LIMIT)),
        )
}
