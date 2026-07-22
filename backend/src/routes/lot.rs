use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::get,
};

use crate::AppError;
use crate::AppState;
use crate::db;
use crate::language::Language;
use crate::localized::LocalizedLot;
use crate::lot_crud;

use super::{VaryLang, vary_accept_language};

async fn get_lot_by_number(
    State(app_state): State<Arc<AppState>>,
    Path(lot_number): Path<i32>,
    lang: Language,
) -> Result<(VaryLang, Json<LocalizedLot>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let row = lot_crud::get_lot_page(&mut conn, lot_number)?
        .ok_or(AppError::NotFound(format!("Lot {} not found", lot_number)))?;

    Ok((
        vary_accept_language(),
        Json(LocalizedLot::from_lot_page(
            row,
            lang,
            app_state.current_eur_rate(),
        )),
    ))
}

/// Routes mounted at `/api/...` (public, rate-limited via `public_api_rate_limit`).
pub fn public_router() -> Router<Arc<AppState>> {
    Router::new().route("/api/lots/{lot_number}", get(get_lot_by_number))
}
