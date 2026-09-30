// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "acidity_type_enum"))]
    pub struct AcidityTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "body_type_enum"))]
    pub struct BodyTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "customer_token_purpose_enum"))]
    pub struct CustomerTokenPurposeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "delivery_method_enum"))]
    pub struct DeliveryMethodEnum;

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
        notified_at -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    customer_identities (provider, subject) {
        provider -> Varchar,
        subject -> Varchar,
        customer_id -> Uuid,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    customer_sessions (token_hash) {
        token_hash -> Varchar,
        customer_id -> Uuid,
        created_at -> Timestamptz,
        last_seen_at -> Timestamptz,
        expires_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::CustomerTokenPurposeEnum;

    customer_tokens (customer_id, purpose) {
        customer_id -> Uuid,
        purpose -> CustomerTokenPurposeEnum,
        token_hash -> Varchar,
        new_email -> Nullable<Varchar>,
        expires_at -> Timestamptz,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    customers (id) {
        id -> Uuid,
        email -> Varchar,
        hashed_password -> Nullable<Varchar>,
        email_verified_at -> Nullable<Timestamptz>,
        language -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
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
    newsletter_subscribers (id) {
        id -> Uuid,
        email -> Varchar,
        language -> Varchar,
        confirmed_at -> Nullable<Timestamptz>,
        confirmation_token_hash -> Nullable<Varchar>,
        confirmation_sent_at -> Nullable<Timestamptz>,
        token_expires_at -> Nullable<Timestamptz>,
        created_at -> Timestamptz,
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
    use super::sql_types::OrderStatusEnum;
    use super::sql_types::DeliveryMethodEnum;

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
        client_key_hash -> Nullable<Varchar>,
        shipping_name -> Nullable<Varchar>,
        shipping_phone -> Nullable<Varchar>,
        shipping_line1 -> Nullable<Varchar>,
        shipping_line2 -> Nullable<Varchar>,
        shipping_city -> Nullable<Varchar>,
        shipping_state -> Nullable<Varchar>,
        shipping_postal_code -> Nullable<Varchar>,
        shipping_country -> Nullable<Varchar>,
        customer_id -> Nullable<Uuid>,
        anonymized_at -> Nullable<Timestamptz>,
        delivery_method -> DeliveryMethodEnum,
        shipping_amount_cents -> Int8,
        age_confirmed_at -> Nullable<Timestamptz>,
        locker_id -> Nullable<Int4>,
        locker_name -> Nullable<Varchar>,
        locker_address -> Nullable<Varchar>,
        locker_city -> Nullable<Varchar>,
        locker_county -> Nullable<Varchar>,
        locker_postal_code -> Nullable<Varchar>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::MeadTypeEnum;
    use super::sql_types::SweetnessTypeEnum;
    use super::sql_types::TurbidityTypeEnum;
    use super::sql_types::EffervescenceTypeEnum;
    use super::sql_types::AcidityTypeEnum;
    use super::sql_types::TanninsTypeEnum;
    use super::sql_types::BodyTypeEnum;

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
        weight_grams -> Int4,
    }
}

diesel::table! {
    sameday_lockers (locker_id) {
        locker_id -> Int4,
        name -> Varchar,
        county -> Varchar,
        city -> Varchar,
        address -> Varchar,
        postal_code -> Varchar,
        synced_at -> Timestamptz,
    }
}

diesel::table! {
    shipments (order_id) {
        order_id -> Uuid,
        awb_number -> Nullable<Varchar>,
        service_code -> Varchar,
        parcel_count -> Int4,
        weight_grams -> Int4,
        insured_value_cents -> Int8,
        cost_cents -> Nullable<Int8>,
        status_label -> Nullable<Varchar>,
        status_at -> Nullable<Timestamptz>,
        delivered_at -> Nullable<Timestamptz>,
        canceled -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::DeliveryMethodEnum;

    shipping_rates (delivery_method) {
        delivery_method -> DeliveryMethodEnum,
        price_cents -> Int8,
        free_from_cents -> Nullable<Int8>,
        enabled -> Bool,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    site_settings (setting_key) {
        setting_key -> Varchar,
        setting_value -> Text,
        updated_at -> Timestamptz,
    }
}

diesel::joinable!(customer_identities -> customers (customer_id));
diesel::joinable!(customer_sessions -> customers (customer_id));
diesel::joinable!(customer_tokens -> customers (customer_id));
diesel::joinable!(lots -> products (product_id));
diesel::joinable!(order_items -> orders (order_id));
diesel::joinable!(order_items -> products (product_id));
diesel::joinable!(orders -> customers (customer_id));
diesel::joinable!(products -> images (image_id));
diesel::joinable!(shipments -> orders (order_id));

diesel::allow_tables_to_appear_in_same_query!(
    admin_users,
    blog_posts,
    customer_identities,
    customer_sessions,
    customer_tokens,
    customers,
    exchange_rates,
    images,
    lots,
    newsletter_subscribers,
    order_items,
    orders,
    products,
    sameday_lockers,
    shipments,
    shipping_rates,
    site_settings,
);
