use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{StatusCode, header},
    response::IntoResponse,
    routing::{get, post},
};
use uuid::Uuid;

use crate::AppError;
use crate::AppState;
use crate::db;
use crate::enums::DeliveryMethod;
use crate::language::Language;
use crate::localized::LocalizedShippingRate;
use crate::models::{
    CreateShipmentRequest, LockerMapConfig, Shipment, ShippingOptions, ShippingRate,
};
use crate::routes::{VaryLang, vary_accept_language};
use crate::shipments;
use crate::shipping;

/// Delivery methods the cart can offer. Easybox needs Sameday configured and
/// at least one synced locker.
async fn get_shipping_options(
    State(app_state): State<Arc<AppState>>,
    lang: Language,
) -> Result<(VaryLang, Json<ShippingOptions>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let easybox = app_state.sameday.is_some() && shipping::has_lockers(&mut conn)?;
    let eur_rate = app_state.current_eur_rate();
    let rates = shipping::rates(&mut conn)?
        .iter()
        .filter(|r| r.enabled && (easybox || r.delivery_method != DeliveryMethod::Easybox))
        .map(|r| LocalizedShippingRate::from_rate(r, lang, eur_rate))
        .collect();
    let options = ShippingOptions {
        rates,
        locker_map: app_state
            .sameday
            .as_deref()
            .filter(|_| easybox)
            .map(|client| LockerMapConfig {
                client_id: client.locker_client_id().to_string(),
                api_username: client.api_username().to_string(),
            }),
    };
    Ok((vary_accept_language(), Json(options)))
}

async fn get_rates_admin(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<ShippingRate>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    Ok(Json(shipping::rates(&mut conn)?))
}

async fn update_rate_admin(
    State(app_state): State<Arc<AppState>>,
    Json(rate): Json<ShippingRate>,
) -> Result<Json<Vec<ShippingRate>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    shipping::update_rate(&mut conn, &rate)?;
    Ok(Json(shipping::rates(&mut conn)?))
}

async fn create_shipment(
    State(app_state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
    Json(request): Json<CreateShipmentRequest>,
) -> Result<Json<Shipment>, AppError> {
    Ok(Json(
        shipments::create(&app_state, order_id, &request).await?,
    ))
}

async fn cancel_shipment(
    State(app_state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    shipments::cancel(&app_state, order_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn shipment_label(
    State(app_state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let pdf = shipments::label(&app_state, order_id).await?;
    Ok((
        [
            (header::CONTENT_TYPE, "application/pdf".to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"awb-{order_id}.pdf\""),
            ),
        ],
        pdf,
    ))
}

/// Suggested parcel weight for the admin's waybill form.
async fn shipment_weight(
    State(app_state): State<Arc<AppState>>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<i64>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    Ok(Json(shipments::order_weight_grams(&mut conn, order_id)?))
}

pub fn public_router() -> Router<Arc<AppState>> {
    Router::new().route("/api/shipping/options", get(get_shipping_options))
}

pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/shipping/rates",
            get(get_rates_admin).put(update_rate_admin),
        )
        .route(
            "/orders/{order_id}/awb",
            post(create_shipment).delete(cancel_shipment),
        )
        .route("/orders/{order_id}/awb/label", get(shipment_label))
        .route("/orders/{order_id}/awb/weight", get(shipment_weight))
}
