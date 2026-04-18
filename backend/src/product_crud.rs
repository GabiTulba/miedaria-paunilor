use crate::enums::*;
use crate::models::{Image, NewProduct, Product};
use crate::schema::*;
use chrono;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum ProductValidationError {
    InvalidProductId,
    ProductIdTooLong,
    EmptyProductName,
    ProductNameTooLong,
    EmptyProductNameRo,
    ProductNameRoTooLong,
    EmptyProductDescription,
    EmptyProductDescriptionRo,
    EmptyIngredients,
    EmptyIngredientsRo,
    InvalidAbv,
    InvalidBottleCount,
    InvalidBottleSize,
    InvalidPrice,
    InvalidPriceRon,
    InvalidAbvPrecision,
    InvalidPricePrecision,
    InvalidPriceRonPrecision,
    InvalidBottlingDate,
    InvalidLotNumber,
}

struct ProductValidationInput<'a> {
    product_id: &'a str,
    product_name: &'a str,
    product_name_ro: &'a str,
    product_description: &'a str,
    product_description_ro: &'a str,
    ingredients: &'a str,
    ingredients_ro: &'a str,
    abv: Decimal,
    bottle_count: i32,
    bottle_size: i32,
    price: Decimal,
    price_ron: Decimal,
    bottling_date: chrono::NaiveDate,
    lot_number: i32,
}

impl<'a> From<&'a NewProduct> for ProductValidationInput<'a> {
    fn from(p: &'a NewProduct) -> Self {
        Self {
            product_id: &p.product_id,
            product_name: &p.product_name,
            product_name_ro: &p.product_name_ro,
            product_description: &p.product_description,
            product_description_ro: &p.product_description_ro,
            ingredients: &p.ingredients,
            ingredients_ro: &p.ingredients_ro,
            abv: p.abv,
            bottle_count: p.bottle_count,
            bottle_size: p.bottle_size,
            price: p.price,
            price_ron: p.price_ron,
            bottling_date: p.bottling_date,
            lot_number: p.lot_number,
        }
    }
}

impl<'a> From<&'a Product> for ProductValidationInput<'a> {
    fn from(p: &'a Product) -> Self {
        Self {
            product_id: &p.product_id,
            product_name: &p.product_name,
            product_name_ro: &p.product_name_ro,
            product_description: &p.product_description,
            product_description_ro: &p.product_description_ro,
            ingredients: &p.ingredients,
            ingredients_ro: &p.ingredients_ro,
            abv: p.abv,
            bottle_count: p.bottle_count,
            bottle_size: p.bottle_size,
            price: p.price,
            price_ron: p.price_ron,
            bottling_date: p.bottling_date,
            lot_number: p.lot_number,
        }
    }
}

fn validate_product(input: &ProductValidationInput) -> Vec<ProductValidationError> {
    // ABV: 0.0–99.9 (DECIMAL(3,1))
    let abv_min = Decimal::new(0, 1);
    let abv_max = Decimal::new(999, 1);
    // EUR price: 0.00–999.99 (DECIMAL(5,2))
    let price_min = Decimal::new(0, 2);
    let price_max_eur = Decimal::new(99999, 2);
    // RON price: 0.00–99999.99 (DECIMAL(7,2))
    let price_max_ron = Decimal::new(9999999, 2);

    let mut errors = Vec::new();

    // product_id: lowercase letters, digits, hyphens, underscores.
    if !crate::utils::is_valid_slug(input.product_id) {
        errors.push(ProductValidationError::InvalidProductId);
    } else if input.product_id.len() > 128 {
        errors.push(ProductValidationError::ProductIdTooLong);
    }

    // product_name: A short string that supports any character.
    if input.product_name.is_empty() {
        errors.push(ProductValidationError::EmptyProductName);
    } else if input.product_name.len() > 256 {
        errors.push(ProductValidationError::ProductNameTooLong);
    }

    // product_name_ro: Romanian product name.
    if input.product_name_ro.is_empty() {
        errors.push(ProductValidationError::EmptyProductNameRo);
    } else if input.product_name_ro.len() > 256 {
        errors.push(ProductValidationError::ProductNameRoTooLong);
    }

    // product_description: A long, free-form text string.
    if input.product_description.is_empty() {
        errors.push(ProductValidationError::EmptyProductDescription);
    }

    // product_description_ro: Romanian product description.
    if input.product_description_ro.is_empty() {
        errors.push(ProductValidationError::EmptyProductDescriptionRo);
    }

    // ingredients: A text field for the ingredients of the product.
    if input.ingredients.is_empty() {
        errors.push(ProductValidationError::EmptyIngredients);
    }

    // ingredients_ro: Romanian ingredients.
    if input.ingredients_ro.is_empty() {
        errors.push(ProductValidationError::EmptyIngredientsRo);
    }

    // abv: Decimal with one digit of precision, valid ranges from 0.0 to 99.9.
    if input.abv < abv_min || input.abv > abv_max {
        errors.push(ProductValidationError::InvalidAbv);
    }
    if input.abv.scale() > 1 {
        errors.push(ProductValidationError::InvalidAbvPrecision);
    }

    // bottle_count: Non-negative integer.
    if input.bottle_count < 0 {
        errors.push(ProductValidationError::InvalidBottleCount);
    }

    // bottle_size: Positive integer (mililiters of volume).
    if input.bottle_size <= 0 {
        errors.push(ProductValidationError::InvalidBottleSize);
    }

    // price: Decimal with two digits of precision.
    if input.price < price_min || input.price > price_max_eur {
        errors.push(ProductValidationError::InvalidPrice);
    }
    if input.price.scale() > 2 {
        errors.push(ProductValidationError::InvalidPricePrecision);
    }

    // price_ron: Decimal with two digits of precision.
    if input.price_ron < price_min || input.price_ron > price_max_ron {
        errors.push(ProductValidationError::InvalidPriceRon);
    }
    if input.price_ron.scale() > 2 {
        errors.push(ProductValidationError::InvalidPriceRonPrecision);
    }

    // bottling_date: Date - should not be in the future
    let today = chrono::Local::now().date_naive();
    if input.bottling_date > today {
        errors.push(ProductValidationError::InvalidBottlingDate);
    }

    // lot_number: Positive integer
    if input.lot_number <= 0 {
        errors.push(ProductValidationError::InvalidLotNumber);
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
            }
            _ => ProductCreationError::UnknownError,
        }
    }
}

#[derive(Debug, Serialize, Queryable, Selectable)]
#[diesel(table_name = products)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ProductWithImage {
    #[diesel(embed)]
    pub product: Product,
    #[diesel(embed)]
    pub image: Option<Image>,
}

pub fn create_product(
    conn: &mut PgConnection,
    new_product: &NewProduct,
) -> Result<Product, ProductCreationError> {
    let validation_errors = validate_product(&ProductValidationInput::from(new_product));
    if !validation_errors.is_empty() {
        return Err(ProductCreationError::ValidationErrors(validation_errors));
    }

    diesel::insert_into(products::table)
        .values(new_product)
        .returning(Product::as_returning())
        .get_result(conn)
        .map_err(ProductCreationError::from)
}

pub fn get_product(conn: &mut PgConnection, id: &str) -> QueryResult<Option<ProductWithImage>> {
    use crate::schema::images::dsl::images;
    use crate::schema::products::dsl::*;

    products
        .left_join(images)
        .filter(product_id.eq(id))
        .select(ProductWithImage::as_select())
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

pub fn update_product(
    conn: &mut PgConnection,
    product: &Product,
) -> Result<Product, ProductUpdateError> {
    let validation_errors = validate_product(&ProductValidationInput::from(product));
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

pub fn get_all_products(
    conn: &mut PgConnection,
    order_by: Option<&str>,
    in_stock: Option<bool>,
    order_direction: Option<&str>,
    product_type_filter: Option<MeadType>,
    sweetness_filter: Option<SweetnessType>,
    turbidity_filter: Option<TurbidityType>,
    effervescence_filter: Option<EffervescenceType>,
    acidity_filter: Option<AcidityType>,
    tannins_filter: Option<TanninsType>,
    body_filter: Option<BodyType>,
    limit: i64,
    offset: i64,
) -> QueryResult<Vec<ProductWithImage>> {
    use crate::schema::images::dsl::images;
    use crate::schema::products::dsl::*;
    use diesel::ExpressionMethods; // Import ExpressionMethods to use .asc() and .desc()

    let mut query = products.left_join(images).into_boxed();

    if let Some(true) = in_stock {
        query = query.filter(bottle_count.gt(0));
    }

    if let Some(filter_value) = product_type_filter {
        query = query.filter(product_type.eq(filter_value));
    }

    if let Some(filter_value) = sweetness_filter {
        query = query.filter(sweetness.eq(filter_value));
    }

    if let Some(filter_value) = turbidity_filter {
        query = query.filter(turbidity.eq(filter_value));
    }

    if let Some(filter_value) = effervescence_filter {
        query = query.filter(effervescence.eq(filter_value));
    }

    if let Some(filter_value) = acidity_filter {
        query = query.filter(acidity.eq(filter_value));
    }

    if let Some(filter_value) = tannins_filter {
        query = query.filter(tannins.eq(filter_value));
    }

    if let Some(filter_value) = body_filter {
        query = query.filter(body.eq(filter_value));
    }

    if let Some(order_by_col) = order_by {
        let sorted_query = match order_by_col {
            "price" => {
                if let Some("desc") = order_direction {
                    query.order(price.desc())
                } else {
                    query.order(price.asc())
                }
            }
            "volume" => {
                if let Some("desc") = order_direction {
                    query.order(bottle_size.desc())
                } else {
                    query.order(bottle_size.asc())
                }
            }
            "bottling_date" => {
                if let Some("desc") = order_direction {
                    query.order(bottling_date.desc())
                } else {
                    query.order(bottling_date.asc())
                }
            }
            _ => {
                // If order_by is specified but not recognized, do nothing (no specific order)
                query
            }
        };
        query = sorted_query;
    }

    query
        .select(ProductWithImage::as_select())
        .limit(limit)
        .offset(offset)
        .load(conn)
}
