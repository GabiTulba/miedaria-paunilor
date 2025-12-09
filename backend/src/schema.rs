// @generated automatically by Diesel CLI.

diesel::table! {
    admin_users (username) {
        username -> Varchar,
        salt -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::table! {
    images (id) {
        id -> Uuid,
        file_name -> Varchar,
        storage_path -> Varchar,
        created_at -> Timestamp,
        file_size -> Int8,
    }
}

diesel::table! {
    products (product_id) {
        product_id -> Varchar,
        product_name -> Varchar,
        product_description -> Text,
        ingredients -> Text,
        product_type -> Varchar,
        sweetness -> Varchar,
        turbidity -> Varchar,
        effervescence -> Varchar,
        acidity -> Varchar,
        tanins -> Varchar,
        body -> Varchar,
        abv -> Numeric,
        bottle_count -> Int4,
        bottle_size -> Int4,
        price -> Numeric,
        image_id -> Uuid,
    }
}

diesel::table! {
    users (username) {
        username -> Varchar,
        salt -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::joinable!(products -> images (image_id));

diesel::allow_tables_to_appear_in_same_query!(admin_users, images, products, users,);
