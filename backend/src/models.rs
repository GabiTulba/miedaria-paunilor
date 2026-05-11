use serde::Serialize;
use crate::enums::*;
use crate::schema::*;
use chrono;
use diesel::prelude::*;
use rust_decimal::Decimal;
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
    pub price: Decimal,
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
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub price_ron: Decimal,
    pub image_id: Option<uuid::Uuid>,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
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

#[derive(serde::Deserialize, AsChangeset, Debug, TS)]
#[diesel(table_name = blog_posts)]
#[ts(export)]
pub struct UpdateBlogPost {
    #[ts(optional)] pub title: Option<String>,
    #[ts(optional)] pub title_ro: Option<String>,
    #[ts(optional)] pub slug: Option<String>,
    #[ts(optional)] pub content_markdown: Option<String>,
    #[ts(optional)] pub content_markdown_ro: Option<String>,
    #[ts(optional)] pub excerpt: Option<String>,
    #[ts(optional)] pub excerpt_ro: Option<String>,
    #[ts(optional)] pub author: Option<String>,
    #[ts(optional)] pub is_published: Option<bool>,
}
