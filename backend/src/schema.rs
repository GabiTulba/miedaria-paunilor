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
    #[diesel(postgres_type(name = "order_status_enum"))]
    pub struct OrderStatusEnum;

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
    exchange_rates (currency, rate_date) {
        currency -> Varchar,
        rate_date -> Date,
        rate -> Numeric,
        fetched_at -> Timestamptz,
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
    lots (lot_number) {
        lot_number -> Int4,
        product_id -> Varchar,
        bottling_date -> Date,
        abv -> Numeric,
        energy_kj -> Numeric,
        energy_kcal -> Numeric,
        fat -> Numeric,
        saturates -> Numeric,
        carbohydrates -> Numeric,
        sugars -> Numeric,
        protein -> Numeric,
        salt -> Numeric,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    order_items (order_item_id) {
        order_item_id -> Uuid,
        order_id -> Uuid,
        product_id -> Varchar,
        product_name -> Varchar,
        unit_amount_cents -> Int8,
        quantity -> Int4,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::*;

    orders (order_id) {
        order_id -> Uuid,
        status -> OrderStatusEnum,
        currency -> Varchar,
        total_amount_cents -> Int8,
        stripe_session_id -> Nullable<Varchar>,
        stripe_payment_intent_id -> Nullable<Varchar>,
        customer_email -> Nullable<Varchar>,
        language -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
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
        price_ron -> Numeric,
        image_id -> Nullable<Uuid>,
        bottling_date -> Date,
        lot_number -> Int4,
        updated_at -> Timestamptz,
        deleted_at -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    site_settings (setting_key) {
        setting_key -> Varchar,
        setting_value -> Text,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    users (username) {
        username -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::joinable!(lots -> products (product_id));
diesel::joinable!(order_items -> orders (order_id));
diesel::joinable!(order_items -> products (product_id));
diesel::joinable!(products -> images (image_id));

diesel::allow_tables_to_appear_in_same_query!(
    admin_users,
    blog_posts,
    exchange_rates,
    images,
    lots,
    order_items,
    orders,
    products,
    site_settings,
    users,
);
