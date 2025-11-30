use diesel::prelude::*;
use crate::models::{Product, NewProduct};
use crate::schema::*;
use diesel::result::{Error as DieselError, DatabaseErrorKind};
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum ProductValidationError {
    InvalidProductId,
    EmptyProductName,
    EmptyProductDescription,
    EmptyIngredients,
    InvalidAbv,
    InvalidBottleCount,
    InvalidBottleSize,
    InvalidPrice,
    InvalidAbvPrecision,
    InvalidPricePrecision,
    EmptyImageUrl, // New variant
}

fn validate_product(new_product: &NewProduct) -> Vec<ProductValidationError> {
    let mut errors = Vec::new();

    // product_id: A short string composed of lowercase letters, dashes or underscores.
    let product_id_is_valid = new_product.product_id.chars().all(|c| c.is_ascii_lowercase() || c == '-' || c == '_');
    if !product_id_is_valid || new_product.product_id.is_empty() {
        errors.push(ProductValidationError::InvalidProductId);
    }

    // product_name: A short string that supports any character.
    if new_product.product_name.is_empty() {
        errors.push(ProductValidationError::EmptyProductName);
    }

    // product_description: A long, free-form text string.
    if new_product.product_description.is_empty() {
        errors.push(ProductValidationError::EmptyProductDescription);
    }
    
    // ingredients: A text field for the ingredients of the product.
    if new_product.ingredients.is_empty() {
        errors.push(ProductValidationError::EmptyIngredients);
    }

    // image_url: Not null, so must be present
    if new_product.image_url.is_empty() {
        errors.push(ProductValidationError::EmptyImageUrl);
    }

    // abv: Decimal with one digit of precision, valid ranges from 0.0 to 99.9.
    if new_product.abv < Decimal::new(0, 1) || new_product.abv > Decimal::new(999, 1) {
        errors.push(ProductValidationError::InvalidAbv);
    }
    if new_product.abv.scale() > 1 {
        errors.push(ProductValidationError::InvalidAbvPrecision);
    }

    // bottle_count: Non-negative integer.
    if new_product.bottle_count < 0 {
        errors.push(ProductValidationError::InvalidBottleCount);
    }

    // bottle_size: Positive integer (mililiters of volume).
    if new_product.bottle_size <= 0 {
        errors.push(ProductValidationError::InvalidBottleSize);
    }

    // price: Decimal with two digits of precision.
    if new_product.price < Decimal::new(0, 2) || new_product.price > Decimal::new(99999, 2) {
        errors.push(ProductValidationError::InvalidPrice);
    }
    if new_product.price.scale() > 2 {
        errors.push(ProductValidationError::InvalidPricePrecision);
    }

    errors
}

#[derive(Debug)]
pub enum ProductCreationError {
    DuplicateProductId,
    DatabaseError(String),
    ValidationErrors(Vec<ProductValidationError>),
    UnknownError,
}

impl From<DieselError> for ProductCreationError {
    fn from(error: DieselError) -> Self {
        match error {
            DieselError::DatabaseError(kind, info) => {
                if let DatabaseErrorKind::UniqueViolation = kind {
                    if let Some(constraint_name) = info.constraint_name() {
                        if constraint_name == "products_pkey" { 
                            return ProductCreationError::DuplicateProductId;
                        }
                    }
                }
                ProductCreationError::DatabaseError(format!("{:?} - {:?}", kind, info))
            },
            _ => ProductCreationError::UnknownError,
        }
    }
}

pub fn create_product(conn: &mut PgConnection, new_product: &NewProduct) -> Result<Product, ProductCreationError> {
    let validation_errors = validate_product(new_product);
    if !validation_errors.is_empty() {
        return Err(ProductCreationError::ValidationErrors(validation_errors));
    }

    diesel::insert_into(products::table)
        .values(new_product)
        .returning(Product::as_returning())
        .get_result(conn)
        .map_err(ProductCreationError::from)
}

pub fn get_product(conn: &mut PgConnection, id: &str) -> QueryResult<Option<Product>> {
    use crate::schema::products::dsl::*;

    products.find(id)
        .select(Product::as_select())
        .first(conn)
        .optional()
}

#[derive(Debug, Serialize)]
pub enum ProductUpdateError {
    DatabaseError(String),
    ValidationErrors(Vec<ProductValidationError>),
    NotFound,
    UnknownError,
}

impl From<DieselError> for ProductUpdateError {
    fn from(err: DieselError) -> Self {
        match err {
            DieselError::NotFound => ProductUpdateError::NotFound,
            DieselError::DatabaseError(_, info) => {
                ProductUpdateError::DatabaseError(info.message().to_string())
            }
            _ => ProductUpdateError::UnknownError,
        }
    }
}


pub fn update_product(conn: &mut PgConnection, product: &Product) -> Result<Product, ProductUpdateError> {
    let validation_errors = validate_product(&NewProduct {
        product_id: product.product_id.clone(),
        product_name: product.product_name.clone(),
        product_description: product.product_description.clone(),
        ingredients: product.ingredients.clone(),
        abv: product.abv,
        bottle_count: product.bottle_count,
        bottle_size: product.bottle_size,
        price: product.price,
        image_url: product.image_url.clone()
    });
    if !validation_errors.is_empty() {
        return Err(ProductUpdateError::ValidationErrors(validation_errors));
    }

    diesel::update(products::table)
        .filter(products::product_id.eq(&product.product_id))
        .set(product)
        .returning(Product::as_returning())
        .get_result(conn)
        .map_err(ProductUpdateError::from)
}

pub fn delete_product(conn: &mut PgConnection, product_id: &str) -> QueryResult<()> {
    diesel::delete(products::table)
    .filter(products::product_id.eq(product_id))
    .execute(conn)
    .map(|_| ())
}

pub fn get_all_products(conn: &mut PgConnection) -> QueryResult<Vec<Product>> {
    use crate::schema::products::dsl::*;
    products.select(Product::as_select()).load(conn)
}