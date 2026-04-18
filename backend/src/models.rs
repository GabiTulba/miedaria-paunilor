use crate::enums::*;
use crate::schema::*;
use chrono;
use diesel::prelude::*;
use rust_decimal::Decimal;

use uuid;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::admin_users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AdminUser {
    pub username: String,
    pub hashed_password: String,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub username: String,
    pub hashed_password: String,
}

#[derive(Insertable)]
#[diesel(table_name = admin_users)]
pub struct NewAdminUser<'a> {
    pub username: &'a str,
    pub hashed_password: &'a str,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
    pub username: &'a str,
    pub hashed_password: &'a str,
}

#[derive(Queryable, Selectable, serde::Serialize, serde::Deserialize, Debug)]
#[diesel(table_name = crate::schema::images)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Image {
    pub id: uuid::Uuid,
    pub file_name: String,
    pub storage_path: String,
    pub created_at: chrono::NaiveDateTime,
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
    pub storage_path: Option<String>,
}

#[derive(Queryable, Selectable, AsChangeset, serde::Serialize, serde::Deserialize, Debug)]
#[diesel(table_name = crate::schema::products)]
#[diesel(check_for_backend(diesel::pg::Pg))]
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
    pub tanins: TaninsType,
    pub body: BodyType,
    #[serde(with = "rust_decimal::serde::float")]
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    #[serde(with = "rust_decimal::serde::float")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub price_ron: Decimal,
    pub image_id: uuid::Uuid,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
}

#[derive(Insertable, serde::Deserialize)]
#[diesel(table_name = products)]
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
    pub tanins: TaninsType,
    pub body: BodyType,
    #[serde(with = "rust_decimal::serde::float")]
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    #[serde(with = "rust_decimal::serde::float")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub price_ron: Decimal,
    pub image_id: uuid::Uuid,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
}

#[derive(Queryable, Selectable, serde::Serialize, serde::Deserialize, Debug)]
#[diesel(table_name = crate::schema::blog_posts)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct BlogPost {
    pub id: uuid::Uuid,
    pub title: String,
    pub title_ro: String,
    pub blog_id: String,
    pub content_markdown: String,
    pub content_markdown_ro: String,
    pub excerpt: String,
    pub excerpt_ro: String,
    pub author: String,
    pub published_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
    pub is_published: bool,
}

#[derive(Insertable, serde::Deserialize)]
#[diesel(table_name = blog_posts)]
pub struct NewBlogPost {
    pub title: String,
    pub title_ro: String,
    pub blog_id: String,
    pub content_markdown: String,
    pub content_markdown_ro: String,
    pub excerpt: String,
    pub excerpt_ro: String,
    pub author: String,
    pub is_published: bool,
}

#[derive(serde::Deserialize, AsChangeset, Debug)]
#[diesel(table_name = blog_posts)]
pub struct UpdateBlogPost {
    pub title: Option<String>,
    pub title_ro: Option<String>,
    pub blog_id: Option<String>,
    pub content_markdown: Option<String>,
    pub content_markdown_ro: Option<String>,
    pub excerpt: Option<String>,
    pub excerpt_ro: Option<String>,
    pub author: Option<String>,
    pub is_published: Option<bool>,
}
