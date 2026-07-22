use crate::enums::*;
use crate::schema::*;
use chrono;
use diesel::prelude::*;
use rust_decimal::Decimal;
use serde::Serialize;
use ts_rs::TS;

use uuid;

#[derive(Serialize, TS)]
#[ts(export)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    #[ts(type = "number")]
    pub total_pages: u64,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::admin_users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AdminUser {
    pub username: String,
    pub hashed_password: String,
}

#[derive(Insertable)]
#[diesel(table_name = admin_users)]
pub struct NewAdminUser<'a> {
    pub username: &'a str,
    pub hashed_password: &'a str,
}

#[derive(Queryable, Selectable, serde::Serialize, serde::Deserialize, Debug, TS)]
#[diesel(table_name = crate::schema::images)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct Image {
    pub id: uuid::Uuid,
    pub file_name: String,
    pub storage_path: String,
    pub created_at: chrono::NaiveDateTime,
    #[ts(type = "number")]
    pub file_size: i64,
}

#[derive(Insertable, serde::Deserialize)]
#[diesel(table_name = images)]
pub struct NewImage {
    pub file_name: String,
    pub storage_path: String,
    pub file_size: i64,
}

#[derive(serde::Deserialize, AsChangeset, Debug)]
#[diesel(table_name = images)]
pub struct UpdateImage {
    pub file_name: Option<String>,
}

/// Internal changeset including server-managed `storage_path`. Never accept
/// `storage_path` from clients — it would let an attacker point the row at any
/// path on disk via a path-traversal payload.
#[derive(AsChangeset, Debug)]
#[diesel(table_name = images)]
pub struct UpdateImageInternal {
    pub file_name: Option<String>,
    pub storage_path: Option<String>,
}

#[derive(Queryable, Selectable, AsChangeset, serde::Serialize, serde::Deserialize, Debug, TS)]
#[diesel(table_name = crate::schema::products)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct Product {
    pub product_id: String,
    pub product_name: String,
    pub product_name_ro: String,
    pub product_description: String,
    pub product_description_ro: String,
    pub ingredients: String,
    pub ingredients_ro: String,
    pub product_type: MeadType,
    pub sweetness: SweetnessType,
    pub turbidity: TurbidityType,
    pub effervescence: EffervescenceType,
    pub acidity: AcidityType,
    pub tannins: TanninsType,
    pub body: BodyType,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub price_ron: Decimal,
    pub image_id: Option<uuid::Uuid>,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
    pub updated_at: chrono::NaiveDateTime,
    #[diesel(skip_update)]
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Insertable, serde::Deserialize, TS)]
#[diesel(table_name = products)]
#[ts(export)]
pub struct NewProduct {
    pub product_id: String,
    pub product_name: String,
    pub product_name_ro: String,
    pub product_description: String,
    pub product_description_ro: String,
    pub ingredients: String,
    pub ingredients_ro: String,
    pub product_type: MeadType,
    pub sweetness: SweetnessType,
    pub turbidity: TurbidityType,
    pub effervescence: EffervescenceType,
    pub acidity: AcidityType,
    pub tannins: TanninsType,
    pub body: BodyType,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub price_ron: Decimal,
    pub image_id: Option<uuid::Uuid>,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
}

/// EU nutrition declaration for one bottling batch, per 100 ml. Embedded in
/// the `lots` table and flattened into the admin product payloads so the form
/// submits one flat JSON object.
#[derive(
    Queryable,
    Selectable,
    Insertable,
    AsChangeset,
    serde::Serialize,
    serde::Deserialize,
    Debug,
    Clone,
    TS,
)]
#[diesel(table_name = lots)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct LotNutrition {
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub energy_kj: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub energy_kcal: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub fat: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub saturates: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub carbohydrates: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub sugars: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub protein: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub salt: Decimal,
}

/// Batch snapshot row from `lots`. `bottling_date` and `abv` are frozen at
/// bottling time so old QR codes keep showing the batch they were printed
/// for; server-managed timestamps are not loaded.
#[derive(Queryable, Selectable, Debug)]
#[diesel(table_name = lots)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Lot {
    pub lot_number: i32,
    pub product_id: String,
    pub bottling_date: chrono::NaiveDate,
    pub abv: Decimal,
    #[diesel(embed)]
    pub nutrition: LotNutrition,
}

/// Insert/update payload for the lot upsert performed on product save.
#[derive(Insertable, AsChangeset, Debug)]
#[diesel(table_name = lots)]
pub struct LotUpsert<'a> {
    pub lot_number: i32,
    pub product_id: &'a str,
    pub bottling_date: chrono::NaiveDate,
    pub abv: Decimal,
    #[diesel(embed)]
    pub nutrition: LotNutrition,
}

/// Admin create-product payload: product fields plus the batch's nutrition
/// declaration, flattened into a single JSON object.
#[derive(serde::Deserialize, TS)]
#[ts(export)]
pub struct CreateProductRequest {
    #[serde(flatten)]
    pub product: NewProduct,
    #[serde(flatten)]
    pub nutrition: LotNutrition,
}

/// Admin update-product payload, mirroring `CreateProductRequest`.
#[derive(serde::Deserialize, TS)]
#[ts(export)]
pub struct UpdateProductRequest {
    #[serde(flatten)]
    pub product: Product,
    #[serde(flatten)]
    pub nutrition: LotNutrition,
}

#[derive(Queryable, Selectable, serde::Serialize, Debug, TS)]
#[diesel(table_name = crate::schema::orders)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct Order {
    pub order_id: uuid::Uuid,
    pub status: OrderStatus,
    pub currency: String,
    #[ts(type = "number")]
    pub total_amount_cents: i64,
    pub stripe_session_id: Option<String>,
    pub stripe_payment_intent_id: Option<String>,
    pub customer_email: Option<String>,
    pub language: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = orders)]
pub struct NewOrder {
    pub currency: String,
    pub total_amount_cents: i64,
    pub language: String,
}

#[derive(Queryable, Selectable, serde::Serialize, Debug, TS)]
#[diesel(table_name = crate::schema::order_items)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct OrderItem {
    pub order_item_id: uuid::Uuid,
    pub order_id: uuid::Uuid,
    pub product_id: String,
    pub product_name: String,
    #[ts(type = "number")]
    pub unit_amount_cents: i64,
    pub quantity: i32,
}

#[derive(Insertable)]
#[diesel(table_name = order_items)]
pub struct NewOrderItem {
    pub order_id: uuid::Uuid,
    pub product_id: String,
    pub product_name: String,
    pub unit_amount_cents: i64,
    pub quantity: i32,
}

/// One cart line sent by the frontend when starting checkout. Quantities and
/// prices are re-validated server-side; the client never sends amounts.
#[derive(serde::Deserialize, Debug, TS)]
#[ts(export)]
pub struct CheckoutItem {
    pub product_id: String,
    pub quantity: i32,
}

#[derive(serde::Deserialize, Debug, TS)]
#[ts(export)]
pub struct CheckoutSessionRequest {
    pub items: Vec<CheckoutItem>,
}

#[derive(serde::Serialize, Debug, TS)]
#[ts(export)]
pub struct CheckoutSessionResponse {
    pub url: String,
}

/// Whether the store currently accepts checkouts. Also the request body for
/// the admin toggle endpoint.
#[derive(serde::Serialize, serde::Deserialize, Debug, TS)]
#[ts(export)]
pub struct CheckoutStatus {
    pub enabled: bool,
}

/// Admin order-detail view: the order row plus its item snapshots.
#[derive(serde::Serialize, Debug, TS)]
#[ts(export)]
pub struct OrderWithItems {
    pub order: Order,
    pub items: Vec<OrderItem>,
}

#[derive(Queryable, Selectable, serde::Serialize, serde::Deserialize, Debug, TS)]
#[diesel(table_name = crate::schema::blog_posts)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct BlogPost {
    pub id: uuid::Uuid,
    pub title: String,
    pub title_ro: String,
    pub slug: String,
    pub content_markdown: String,
    pub content_markdown_ro: String,
    pub excerpt: String,
    pub excerpt_ro: String,
    pub author: String,
    pub published_at: Option<chrono::NaiveDateTime>,
    pub updated_at: chrono::NaiveDateTime,
    pub is_published: bool,
}

#[derive(Insertable, serde::Deserialize, TS)]
#[diesel(table_name = blog_posts)]
#[ts(export)]
pub struct NewBlogPost {
    pub title: String,
    pub title_ro: String,
    pub slug: String,
    pub content_markdown: String,
    pub content_markdown_ro: String,
    pub excerpt: String,
    pub excerpt_ro: String,
    pub author: String,
    pub is_published: bool,
    #[serde(skip_deserializing)]
    #[ts(skip)]
    pub published_at: Option<chrono::NaiveDateTime>,
}

// serde(flatten) buffers the JSON before handing fields to the two inner
// structs; this test pins that the buffered path still routes numbers through
// `rust_decimal::serde::float` correctly.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_product_request_flattens_product_and_nutrition() {
        let json = serde_json::json!({
            "product_id": "test-mead",
            "product_name": "Test Mead",
            "product_name_ro": "Mied de test",
            "product_description": "desc",
            "product_description_ro": "descriere",
            "ingredients": "honey, water",
            "ingredients_ro": "miere, apă",
            "product_type": "hidromel",
            "sweetness": "semi-sweet",
            "turbidity": "crystalline",
            "effervescence": "flat",
            "acidity": "mild",
            "tannins": "mild",
            "body": "medium",
            "abv": 12.5,
            "bottle_count": 10,
            "bottle_size": 500,
            "price_ron": 75.0,
            "image_id": null,
            "bottling_date": "2026-01-10",
            "lot_number": 42,
            "energy_kj": 280.5,
            "energy_kcal": 67.0,
            "fat": 0.0,
            "saturates": 0.0,
            "carbohydrates": 8.25,
            "sugars": 6.5,
            "protein": 0.3,
            "salt": 0.01
        });

        let req: CreateProductRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.product.product_id, "test-mead");
        assert_eq!(req.product.lot_number, 42);
        assert_eq!(req.product.abv, Decimal::new(125, 1));
        assert_eq!(req.nutrition.energy_kj, Decimal::new(2805, 1));
        assert_eq!(req.nutrition.carbohydrates, Decimal::new(825, 2));
        assert_eq!(req.nutrition.salt, Decimal::new(1, 2));
    }
}

#[derive(serde::Deserialize, AsChangeset, Debug, TS)]
#[diesel(table_name = blog_posts)]
#[ts(export)]
pub struct UpdateBlogPost {
    #[ts(optional)]
    pub title: Option<String>,
    #[ts(optional)]
    pub title_ro: Option<String>,
    #[ts(optional)]
    pub slug: Option<String>,
    #[ts(optional)]
    pub content_markdown: Option<String>,
    #[ts(optional)]
    pub content_markdown_ro: Option<String>,
    #[ts(optional)]
    pub excerpt: Option<String>,
    #[ts(optional)]
    pub excerpt_ro: Option<String>,
    #[ts(optional)]
    pub author: Option<String>,
    #[ts(optional)]
    pub is_published: Option<bool>,
}
