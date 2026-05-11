use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
};

use crate::AppError;
use crate::AppState;
use crate::db;
use crate::enums::*;
use crate::image_crud;
use crate::language::Language;
use crate::localized::LocalizedProductWithImage;
use crate::models::{self, PaginatedResponse};
use crate::pagination::{self, PageQuery};
use crate::product_crud::{
    self, IncludeDeleted, ListProductsOptions, ProductFilters, ProductWithImage,
};

use super::{VaryLang, vary_accept_language};

#[derive(Debug, serde::Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct GetProductsQuery {
    #[ts(optional)] order_by: Option<String>,
    #[ts(optional)] order_direction: Option<String>,
    #[ts(optional)] search: Option<String>,
    #[ts(optional)] in_stock: Option<bool>,
    #[ts(optional)] product_type: Option<MeadType>,
    #[ts(optional)] sweetness: Option<SweetnessType>,
    #[ts(optional)] turbidity: Option<TurbidityType>,
    #[ts(optional)] effervescence: Option<EffervescenceType>,
    #[ts(optional)] acidity: Option<AcidityType>,
    #[ts(optional)] tannins: Option<TanninsType>,
    #[ts(optional)] body: Option<BodyType>,
    #[ts(optional)] page: Option<u32>,
    #[ts(optional)] per_page: Option<u32>,
}

impl GetProductsQuery {
    fn filters(&self) -> ProductFilters {
        ProductFilters {
            in_stock: self.in_stock,
            product_type: self.product_type,
            sweetness: self.sweetness,
            turbidity: self.turbidity,
            effervescence: self.effervescence,
            acidity: self.acidity,
            tannins: self.tannins,
            body: self.body,
        }
    }
    fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page,
            per_page: self.per_page,
        }
    }
}

#[derive(Debug, serde::Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct GetAdminProductsQuery {
    #[ts(optional)] include_deleted: Option<IncludeDeleted>,
    #[ts(optional)] order_by: Option<String>,
    #[ts(optional)] order_direction: Option<String>,
    #[ts(optional)] in_stock: Option<bool>,
    #[ts(optional)] product_type: Option<MeadType>,
    #[ts(optional)] sweetness: Option<SweetnessType>,
    #[ts(optional)] turbidity: Option<TurbidityType>,
    #[ts(optional)] effervescence: Option<EffervescenceType>,
    #[ts(optional)] acidity: Option<AcidityType>,
    #[ts(optional)] tannins: Option<TanninsType>,
    #[ts(optional)] body: Option<BodyType>,
    #[ts(optional)] page: Option<u32>,
    #[ts(optional)] per_page: Option<u32>,
}

impl GetAdminProductsQuery {
    fn filters(&self) -> ProductFilters {
        ProductFilters {
            in_stock: self.in_stock,
            product_type: self.product_type,
            sweetness: self.sweetness,
            turbidity: self.turbidity,
            effervescence: self.effervescence,
            acidity: self.acidity,
            tannins: self.tannins,
            body: self.body,
        }
    }
    fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page,
            per_page: self.per_page,
        }
    }
}

async fn get_all_products(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetProductsQuery>,
    lang: Language,
) -> Result<(VaryLang, Json<PaginatedResponse<LocalizedProductWithImage>>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    if let Some(s) = query.search.as_deref() {
        product_crud::validate_search_term(s)?;
    }

    let page = query.page_query().resolve(20, 100);

    let opts = ListProductsOptions {
        include_deleted: IncludeDeleted::Active,
        filters: query.filters(),
        search: query.search.as_deref(),
        order_by: query.order_by.as_deref(),
        order_direction: query.order_direction.as_deref(),
    };

    let total_count = product_crud::count_products(&mut conn, &opts)?;
    let products = product_crud::list_products(&mut conn, &opts, page.limit, page.offset)?;

    let items: Vec<_> = products
        .into_iter()
        .map(|p| LocalizedProductWithImage::from_product_with_image(p, lang))
        .collect();

    let total_pages = pagination::total_pages(total_count, page.per_page);

    Ok((
        vary_accept_language(),
        Json(PaginatedResponse { items, total_pages }),
    ))
}

async fn get_product_by_id(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    lang: Language,
) -> Result<(VaryLang, Json<LocalizedProductWithImage>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::get_product(&mut conn, &product_id)?.ok_or(AppError::NotFound(
        format!("Product with id {} not found", product_id),
    ))?;

    Ok((
        vary_accept_language(),
        Json(LocalizedProductWithImage::from_product_with_image(
            product, lang,
        )),
    ))
}

async fn list_products_admin(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetAdminProductsQuery>,
) -> Result<Json<PaginatedResponse<ProductWithImage>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let page = query.page_query().resolve(20, 100);

    let opts = ListProductsOptions {
        include_deleted: query.include_deleted.unwrap_or_default(),
        filters: query.filters(),
        search: None,
        order_by: query.order_by.as_deref(),
        order_direction: query.order_direction.as_deref(),
    };

    let total_count = product_crud::count_products(&mut conn, &opts)?;
    let items = product_crud::list_products(&mut conn, &opts, page.limit, page.offset)?;

    let total_pages = pagination::total_pages(total_count, page.per_page);

    Ok(Json(PaginatedResponse { items, total_pages }))
}

async fn get_product_by_id_admin(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<ProductWithImage>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::get_product_admin(&mut conn, &product_id)?.ok_or(
        AppError::NotFound(format!("Product with id {} not found", product_id)),
    )?;

    Ok(Json(product))
}

async fn restore_product_handler(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let product = product_crud::restore_product(&mut conn, &product_id)?;
    Ok(Json(product))
}

async fn hard_delete_product_handler(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    product_crud::hard_delete_product(&mut conn, &product_id)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn create_product(
    State(app_state): State<Arc<AppState>>,
    Json(new_product): Json<models::NewProduct>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::create_product(&mut conn, &new_product)?;

    Ok(Json(product))
}

async fn update_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(mut product): Json<models::Product>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    product.product_id = product_id;

    let updated_product = product_crud::update_product(&mut conn, &product)?;

    Ok(Json(updated_product))
}

async fn delete_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    // Snapshot the image path while the product still exists so we can clean
    // up its variant files after the soft-delete succeeds. Original is kept on
    // disk to allow restore.
    let storage_path = product_crud::get_product_admin(&mut conn, &product_id)?
        .and_then(|p| p.image)
        .map(|img| img.storage_path);

    product_crud::delete_product(&mut conn, &product_id)?;

    if let Some(path) = storage_path {
        image_crud::delete_image_variants(&path).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Routes mounted at `/api/...` (public, rate-limited via `public_api_rate_limit`).
pub fn public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/products", get(get_all_products))
        .route("/api/products/{product_id}", get(get_product_by_id))
}

/// Routes mounted under `/api/admin/...`.
pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/products", get(list_products_admin).post(create_product))
        .route(
            "/products/{product_id}",
            get(get_product_by_id_admin)
                .put(update_product)
                .delete(delete_product),
        )
        .route("/products/{product_id}/restore", post(restore_product_handler))
        .route(
            "/products/{product_id}/hard",
            delete(hard_delete_product_handler),
        )
}
