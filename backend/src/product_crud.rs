use crate::models::{Image, NewProduct, Product};
use crate::schema::*;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum ProductValidationError {
    InvalidProductId,
    EmptyProductName,
    EmptyProductNameRo,
    EmptyProductDescription,
    EmptyProductDescriptionRo,
    EmptyIngredients,
    EmptyIngredientsRo,
    InvalidProductType,
    InvalidSweetnessType,

    InvalidTurbidityType,
    InvalidEffervescenceType,
    InvalidAcidityType,
    InvalidTaninsType,
    InvalidBodyType,
    InvalidAbv,
    InvalidBottleCount,
    InvalidBottleSize,
    InvalidPrice,
    InvalidPriceRon,
    InvalidAbvPrecision,
    InvalidPricePrecision,
    InvalidPriceRonPrecision,
}

fn validate_product(new_product: &NewProduct) -> Vec<ProductValidationError> {
    let mut errors = Vec::new();

    // product_id: A short string composed of lowercase letters, dashes or underscores.
    let product_id_is_valid = new_product
        .product_id
        .chars()
        .all(|c| c.is_ascii_lowercase() || c == '-' || c == '_');
    if !product_id_is_valid || new_product.product_id.is_empty() {
        errors.push(ProductValidationError::InvalidProductId);
    }

    // product_name: A short string that supports any character.
    if new_product.product_name.is_empty() {
        errors.push(ProductValidationError::EmptyProductName);
    }

    // product_name_ro: Romanian product name.
    if new_product.product_name_ro.is_empty() {
        errors.push(ProductValidationError::EmptyProductNameRo);
    }

    // product_description: A long, free-form text string.
    if new_product.product_description.is_empty() {
        errors.push(ProductValidationError::EmptyProductDescription);
    }

    // product_description_ro: Romanian product description.
    if new_product.product_description_ro.is_empty() {
        errors.push(ProductValidationError::EmptyProductDescriptionRo);
    }

    // ingredients: A text field for the ingredients of the product.
    if new_product.ingredients.is_empty() {
        errors.push(ProductValidationError::EmptyIngredients);
    }

    // ingredients_ro: Romanian ingredients.
    if new_product.ingredients_ro.is_empty() {
        errors.push(ProductValidationError::EmptyIngredientsRo);
    }

    // product_type: String - must be a valid MeadType
    if !crate::enums::MeadType::from_str(&new_product.product_type).is_some() {
        errors.push(ProductValidationError::InvalidProductType);
    }

    // sweetness: String - must be a valid SweetnessType
    if !crate::enums::SweetnessType::from_str(&new_product.sweetness).is_some() {
        errors.push(ProductValidationError::InvalidSweetnessType);
    }

    // turbidity: String - must be a valid TurbidityType
    if !crate::enums::TurbidityType::from_str(&new_product.turbidity).is_some() {
        errors.push(ProductValidationError::InvalidTurbidityType);
    }

    // effervescence: String - must be a valid EffervescenceType
    if !crate::enums::EffervescenceType::from_str(&new_product.effervescence).is_some() {
        errors.push(ProductValidationError::InvalidEffervescenceType);
    }

    // acidity: String - must be a valid AcidityType
    if !crate::enums::AcidityType::from_str(&new_product.acidity).is_some() {
        errors.push(ProductValidationError::InvalidAcidityType);
    }

    // tanins: String - must be a valid TaninsType
    if !crate::enums::TaninsType::from_str(&new_product.tanins).is_some() {
        errors.push(ProductValidationError::InvalidTaninsType);
    }

    // body: String - must be a valid BodyType
    if !crate::enums::BodyType::from_str(&new_product.body).is_some() {
        errors.push(ProductValidationError::InvalidBodyType);
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

    // price_ron: Decimal with two digits of precision.
    if new_product.price_ron < Decimal::new(0, 2)
        || new_product.price_ron > Decimal::new(9999999, 2)
    {
        errors.push(ProductValidationError::InvalidPriceRon);
    }
    if new_product.price_ron.scale() > 2 {
        errors.push(ProductValidationError::InvalidPriceRonPrecision);
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
    let validation_errors = validate_product(&NewProduct {
        product_id: product.product_id.clone(),
        product_name: product.product_name.clone(),
        product_name_ro: product.product_name_ro.clone(),
        product_description: product.product_description.clone(),
        product_description_ro: product.product_description_ro.clone(),
        ingredients: product.ingredients.clone(),
        ingredients_ro: product.ingredients_ro.clone(),
        product_type: product.product_type.clone(),
        sweetness: product.sweetness.clone(),

        turbidity: product.turbidity.clone(),
        effervescence: product.effervescence.clone(),
        acidity: product.acidity.clone(),
        tanins: product.tanins.clone(),
        body: product.body.clone(),
        abv: product.abv,
        bottle_count: product.bottle_count,
        bottle_size: product.bottle_size,
        price: product.price,
        price_ron: product.price_ron,
        image_id: product.image_id,
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

pub fn get_all_products(
    conn: &mut PgConnection,
    order_by: Option<&str>,
    in_stock: Option<bool>,
    order_direction: Option<&str>,
    product_type_filter: Option<&str>,
    sweetness_filter: Option<&str>,
    turbidity_filter: Option<&str>,
    effervescence_filter: Option<&str>,
    acidity_filter: Option<&str>,
    tanins_filter: Option<&str>,
    body_filter: Option<&str>,
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

    if let Some(filter_value) = tanins_filter {
        query = query.filter(tanins.eq(filter_value));
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
            _ => {
                // If order_by is specified but not recognized, do nothing (no specific order)
                query
            }
        };
        query = sorted_query;
    }

    query.select(ProductWithImage::as_select()).load(conn)
}
