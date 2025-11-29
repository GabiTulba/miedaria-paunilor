use diesel::prelude::*;
use rust_decimal::Decimal;
use crate::schema::*;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::admin_users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AdminUser {
    pub username: String,
    pub salt: String,
    pub hashed_password: String,
    
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub username: String,
    pub salt: String,
    pub hashed_password: String,
    
}


#[derive(Insertable)]
#[diesel(table_name = admin_users)]
pub struct NewAdminUser<'a> {
    pub username: &'a str,
    pub salt: &'a str,
    pub hashed_password: &'a str
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
    pub username: &'a str,
    pub salt: &'a str,
    pub hashed_password: &'a str
}

// diesel::table! {
//     products (product_id) {
//         product_id -> Varchar,
//         product_name -> Varchar,
//         product_description -> Text,
//         ingredients -> Text,
//         abv -> Numeric,
//         bottle_count -> Int4,
//         bottle_size -> Int4,
//         price -> Numeric,
//     }
// }

#[derive(Queryable, Selectable, AsChangeset, serde::Serialize, serde::Deserialize, Debug)]
#[diesel(table_name = crate::schema::products)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Product {
    pub product_id: String,
    pub product_name: String,
    pub product_description: String,
    pub ingredients: String,
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    pub price: Decimal,
}

#[derive(Insertable, serde::Deserialize)]
#[diesel(table_name = products)]
pub struct NewProduct {
    pub product_id: String,
    pub product_name: String,
    pub product_description: String,
    pub ingredients: String,
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    pub price: Decimal,
}