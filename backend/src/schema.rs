// @generated automatically by Diesel CLI.

diesel::table! {
    admin_users (username) {
        username -> Varchar,
        salt -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::table! {
    products (product_id) {
        product_id -> Varchar,
        product_name -> Varchar,
        product_description -> Text,
        ingredients -> Text,
        abv -> Numeric,
        bottle_count -> Int4,
        bottle_size -> Int4,
        price -> Numeric,
    }
}

diesel::table! {
    users (username) {
        username -> Varchar,
        salt -> Varchar,
        hashed_password -> Varchar,
    }
}

diesel::allow_tables_to_appear_in_same_query!(admin_users, products, users,);
