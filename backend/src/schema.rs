// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "acidity_type_enum"))]
    pub struct AcidityTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "body_type_enum"))]
    pub struct BodyTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "effervescence_type_enum"))]
    pub struct EffervescenceTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "mead_type_enum"))]
    pub struct MeadTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "sweetness_type_enum"))]
    pub struct SweetnessTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "tannins_type_enum"))]
    pub struct TanninsTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "turbidity_type_enum"))]
    pub struct TurbidityTypeEnum;
}

diesel::table! {
    admin_users (username) {
        username -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::*;

    blog_posts (id) {
        id -> Uuid,
        title -> Varchar,
        title_ro -> Varchar,
        slug -> Varchar,
        content_markdown -> Text,
        content_markdown_ro -> Text,
        excerpt -> Varchar,
        excerpt_ro -> Varchar,
        author -> Varchar,
        published_at -> Nullable<Timestamptz>,
        updated_at -> Timestamptz,
        is_published -> Bool,
    }
}

diesel::table! {
    images (id) {
        id -> Uuid,
        file_name -> Varchar,
        storage_path -> Varchar,
        created_at -> Timestamptz,
        file_size -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::*;

    products (product_id) {
        product_id -> Varchar,
        product_name -> Varchar,
        product_name_ro -> Varchar,
        product_description -> Text,
        product_description_ro -> Text,
        ingredients -> Text,
        ingredients_ro -> Text,
        product_type -> MeadTypeEnum,
        sweetness -> SweetnessTypeEnum,
        turbidity -> TurbidityTypeEnum,
        effervescence -> EffervescenceTypeEnum,
        acidity -> AcidityTypeEnum,
        tannins -> TanninsTypeEnum,
        body -> BodyTypeEnum,
        abv -> Numeric,
        bottle_count -> Int4,
        bottle_size -> Int4,
        price -> Numeric,
        price_ron -> Numeric,
        image_id -> Nullable<Uuid>,
        bottling_date -> Date,
        lot_number -> Int4,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    users (username) {
        username -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::joinable!(products -> images (image_id));

diesel::allow_tables_to_appear_in_same_query!(admin_users, blog_posts, images, products, users,);
