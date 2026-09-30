use crate::AppError;
use crate::enums::OrderStatus;
use crate::enums::*;
use crate::error::RepositoryError;
use crate::lot_crud;
use crate::models::{
    CreateProductRequest, Image, LotNutrition, NewProduct, Product, StockLevel,
    UpdateProductRequest,
};
use crate::schema::*;
use chrono::{DateTime, Duration, Utc};
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use rust_decimal::Decimal;
use serde::Serialize;
use ts_rs::TS;

const MAX_SEARCH_TERM_LEN: usize = 100;

/// Normalizes a free-text search term before it reaches Diesel's `ILIKE`:
/// trims it (a blank term means "no search", not an error) and caps its
/// length so an attacker can't force a multi-megabyte pattern scan.
pub fn normalize_search_term(s: &str) -> Result<Option<&str>, AppError> {
    let trimmed = s.trim();
    if trimmed.chars().count() > MAX_SEARCH_TERM_LEN {
        return Err(AppError::BadRequest(format!(
            "Search term must be at most {} characters",
            MAX_SEARCH_TERM_LEN
        )));
    }
    Ok(Some(trimmed).filter(|t| !t.is_empty()))
}

/// Escapes `ILIKE` metacharacters so the term matches literally (`_` and `%`
/// in a product name are ordinary characters, not wildcards).
fn escape_like(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if matches!(c, '\\' | '%' | '_') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
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
    BottleCountTooLarge,
    InvalidBottleSize,
    InvalidWeightGrams,
    InvalidPriceRon,
    PriceRonBelowMinimum,
    InvalidAbvPrecision,
    InvalidPriceRonPrecision,
    InvalidBottlingDate,
    InvalidLotNumber,
    LotNumberInUse,
    InvalidEnergyKj,
    InvalidEnergyKjPrecision,
    InvalidEnergyKcal,
    InvalidEnergyKcalPrecision,
    InvalidFat,
    InvalidFatPrecision,
    InvalidSaturates,
    InvalidSaturatesPrecision,
    InvalidCarbohydrates,
    InvalidCarbohydratesPrecision,
    InvalidSugars,
    InvalidSugarsPrecision,
    InvalidProtein,
    InvalidProteinPrecision,
    InvalidSalt,
    InvalidSaltPrecision,
    SaturatesExceedFat,
    SugarsExceedCarbohydrates,
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
    weight_grams: i32,
    price_ron: Decimal,
    bottling_date: chrono::NaiveDate,
    lot_number: i32,
}

/// `Product` and `NewProduct` share the validated field set (Diesel generates
/// both from the same schema). The macro emits a `From` impl that copies the
/// same 14 fields from either source — adding a new validated field is a
/// single edit to the macro body.
macro_rules! impl_validation_input_from {
    ($source:ty) => {
        impl<'a> From<&'a $source> for ProductValidationInput<'a> {
            fn from(p: &'a $source) -> Self {
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
                    weight_grams: p.weight_grams,
                    price_ron: p.price_ron,
                    bottling_date: p.bottling_date,
                    lot_number: p.lot_number,
                }
            }
        }
    };
}

impl_validation_input_from!(NewProduct);
impl_validation_input_from!(Product);

const MAX_BOTTLE_COUNT: i32 = 1_000_000;
/// Matches the `products_weight_grams_check` constraint.
const MAX_WEIGHT_GRAMS: i32 = 30_000;

fn validate_product(input: &ProductValidationInput) -> Vec<ProductValidationError> {
    // ABV: 0.0–99.9 (DECIMAL(3,1))
    let abv_min = Decimal::new(0, 1);
    let abv_max = Decimal::new(999, 1);
    // RON price: 0.00–99999.99 (DECIMAL(7,2))
    let price_min = Decimal::new(0, 2);
    let price_max_ron = Decimal::new(9999999, 2);
    // Business minimum: Stripe's minimum charge in RON is 2.00, so a cheaper
    // product could not be bought on its own.
    let price_min_business = Decimal::new(200, 2);

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

    // bottle_count: Non-negative integer with a sane upper bound.
    if input.bottle_count < 0 {
        errors.push(ProductValidationError::InvalidBottleCount);
    } else if input.bottle_count > MAX_BOTTLE_COUNT {
        errors.push(ProductValidationError::BottleCountTooLarge);
    }

    // bottle_size: Positive integer (mililiters of volume).
    if input.bottle_size <= 0 {
        errors.push(ProductValidationError::InvalidBottleSize);
    }

    if !(1..=MAX_WEIGHT_GRAMS).contains(&input.weight_grams) {
        errors.push(ProductValidationError::InvalidWeightGrams);
    }

    // price_ron: Decimal with two digits of precision.
    if input.price_ron < price_min || input.price_ron > price_max_ron {
        errors.push(ProductValidationError::InvalidPriceRon);
    } else if input.price_ron < price_min_business {
        errors.push(ProductValidationError::PriceRonBelowMinimum);
    }
    if input.price_ron.scale() > 2 {
        errors.push(ProductValidationError::InvalidPriceRonPrecision);
    }

    // bottling_date: Date — should not be in the future. Use UTC so the
    // result doesn't depend on the container's TZ env.
    let today = Utc::now().date_naive();
    if input.bottling_date > today {
        errors.push(ProductValidationError::InvalidBottlingDate);
    }

    // lot_number: Positive integer
    if input.lot_number <= 0 {
        errors.push(ProductValidationError::InvalidLotNumber);
    }

    errors
}

/// EU nutrition declaration bounds. Energy columns are DECIMAL(6,1); the
/// per-100ml gram columns are DECIMAL(5,2) and cannot physically exceed 100 g.
fn validate_nutrition(n: &LotNutrition) -> Vec<ProductValidationError> {
    use ProductValidationError::*;

    let energy_max = Decimal::new(999_999, 1); // 99999.9
    let grams_max = Decimal::new(10_000, 2); // 100.00

    let mut errors = Vec::new();

    let energy_fields = [
        (n.energy_kj, InvalidEnergyKj, InvalidEnergyKjPrecision),
        (n.energy_kcal, InvalidEnergyKcal, InvalidEnergyKcalPrecision),
    ];
    for (value, range_error, precision_error) in energy_fields {
        if value < Decimal::ZERO || value > energy_max {
            errors.push(range_error);
        }
        if value.scale() > 1 {
            errors.push(precision_error);
        }
    }

    let gram_fields = [
        (n.fat, InvalidFat, InvalidFatPrecision),
        (n.saturates, InvalidSaturates, InvalidSaturatesPrecision),
        (
            n.carbohydrates,
            InvalidCarbohydrates,
            InvalidCarbohydratesPrecision,
        ),
        (n.sugars, InvalidSugars, InvalidSugarsPrecision),
        (n.protein, InvalidProtein, InvalidProteinPrecision),
        (n.salt, InvalidSalt, InvalidSaltPrecision),
    ];
    for (value, range_error, precision_error) in gram_fields {
        if value < Decimal::ZERO || value > grams_max {
            errors.push(range_error);
        }
        if value.scale() > 2 {
            errors.push(precision_error);
        }
    }

    if n.saturates > n.fat {
        errors.push(SaturatesExceedFat);
    }
    if n.sugars > n.carbohydrates {
        errors.push(SugarsExceedCarbohydrates);
    }

    errors
}

/// Map a Diesel error to a `RepositoryError`, surfacing UniqueViolation on a
/// matching constraint as a typed `Conflict` (with the supplied message) and
/// passing everything else through to `Database`.
fn map_unique_violation(
    e: DieselError,
    constraint_match: impl Fn(&str) -> bool,
    conflict_message: &str,
) -> RepositoryError {
    if let DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, ref info) = e {
        if info.constraint_name().is_some_and(constraint_match) {
            return RepositoryError::Conflict(conflict_message.to_string());
        }
    }
    RepositoryError::Database(e)
}

#[derive(Debug, Serialize, Queryable, Selectable, TS)]
#[diesel(table_name = products)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[ts(export)]
pub struct ProductWithImage {
    #[diesel(embed)]
    pub product: Product,
    #[diesel(embed)]
    pub image: Option<Image>,
}

/// Admin edit-form payload: full bilingual product plus the nutrition
/// declaration of its current lot (`None` for legacy products saved before
/// lots existed).
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct AdminProductDetail {
    pub product: Product,
    pub image: Option<Image>,
    pub nutrition: Option<LotNutrition>,
    /// Bottles held by pending/processing checkouts (not in `bottle_count`).
    #[ts(type = "number")]
    pub reserved_bottles: i64,
}

pub fn create_product(
    conn: &mut PgConnection,
    request: &CreateProductRequest,
) -> Result<Product, RepositoryError> {
    let mut validation_errors = validate_product(&ProductValidationInput::from(&request.product));
    validation_errors.extend(validate_nutrition(&request.nutrition));
    if !validation_errors.is_empty() {
        return Err(RepositoryError::ProductValidation(validation_errors));
    }

    conn.transaction(|conn| {
        let product: Product = diesel::insert_into(products::table)
            .values(&request.product)
            .returning(Product::as_returning())
            .get_result(conn)
            .map_err(|e| {
                map_unique_violation(
                    e,
                    |c| c == "products_pkey",
                    "Product with this ID already exists.",
                )
            })?;

        lot_crud::upsert_lot(conn, &product, &request.nutrition)?;

        Ok(product)
    })
}

pub fn get_product(conn: &mut PgConnection, id: &str) -> QueryResult<Option<ProductWithImage>> {
    use crate::schema::images::dsl::images;
    use crate::schema::products::dsl::*;

    products
        .left_join(images)
        .filter(product_id.eq(id))
        .filter(deleted_at.is_null())
        .select(ProductWithImage::as_select())
        .first(conn)
        .optional()
}

/// Whether `id` is a product on sale (not deleted).
pub fn is_listed(conn: &mut PgConnection, id: &str) -> QueryResult<bool> {
    use crate::schema::products::dsl::*;

    diesel::select(diesel::dsl::exists(
        products
            .filter(product_id.eq(id))
            .filter(deleted_at.is_null()),
    ))
    .get_result(conn)
}

pub fn get_product_admin(
    conn: &mut PgConnection,
    id: &str,
) -> QueryResult<Option<ProductWithImage>> {
    use crate::schema::images::dsl::images;
    use crate::schema::products::dsl::*;

    products
        .left_join(images)
        .filter(product_id.eq(id))
        .select(ProductWithImage::as_select())
        .first(conn)
        .optional()
}

pub fn update_product(
    conn: &mut PgConnection,
    request: &UpdateProductRequest,
) -> Result<Product, RepositoryError> {
    let product = &request.product;
    let mut validation_errors = validate_product(&ProductValidationInput::from(product));
    validation_errors.extend(validate_nutrition(&request.nutrition));
    if !validation_errors.is_empty() {
        return Err(RepositoryError::ProductValidation(validation_errors));
    }

    conn.transaction(|conn| {
        let updated: Product = diesel::update(products::table)
            .filter(products::product_id.eq(&product.product_id))
            .set(product)
            .returning(Product::as_returning())
            .get_result(conn)
            .map_err(|e| match e {
                DieselError::NotFound => RepositoryError::NotFound("Product not found".to_string()),
                other => RepositoryError::Database(other),
            })?;

        lot_crud::upsert_lot(conn, &updated, &request.nutrition)?;

        Ok(updated)
    })
}

pub fn get_product_admin_detail(
    conn: &mut PgConnection,
    id: &str,
) -> Result<Option<AdminProductDetail>, RepositoryError> {
    let Some(pwi) = get_product_admin(conn, id)? else {
        return Ok(None);
    };
    let nutrition = lot_crud::get_current_nutrition(conn, &pwi.product)?;
    let reserved_bottles = reserved_bottles(conn, id)?;
    Ok(Some(AdminProductDetail {
        product: pwi.product,
        image: pwi.image,
        nutrition,
        reserved_bottles,
    }))
}

/// Bottles of `id` currently held by checkouts that may still be paid.
pub fn reserved_bottles(conn: &mut PgConnection, id: &str) -> QueryResult<i64> {
    let total: Option<i64> = order_items::table
        .inner_join(orders::table)
        .filter(order_items::product_id.eq(id))
        .filter(orders::status.eq_any([OrderStatus::Pending, OrderStatus::Processing]))
        .select(diesel::dsl::sum(order_items::quantity))
        .first(conn)?;
    Ok(total.unwrap_or(0))
}

/// Atomically adds `delta` (may be negative) to the sellable stock of `id`.
/// Refuses to go below zero or above `MAX_BOTTLE_COUNT` instead of clamping,
/// so the admin always sees exactly what was applied.
pub fn adjust_stock(
    conn: &mut PgConnection,
    id: &str,
    delta: i32,
) -> Result<StockLevel, RepositoryError> {
    if delta == 0 {
        return Err(RepositoryError::BadRequest(
            "Stock change must not be zero".to_string(),
        ));
    }
    let updated: Option<i32> = diesel::update(
        products::table.filter(
            products::product_id
                .eq(id)
                .and((products::bottle_count + delta).ge(0))
                .and((products::bottle_count + delta).le(MAX_BOTTLE_COUNT)),
        ),
    )
    .set(products::bottle_count.eq(products::bottle_count + delta))
    .returning(products::bottle_count)
    .get_result(conn)
    .optional()?;

    let Some(bottle_count) = updated else {
        let current: Option<i32> = products::table
            .filter(products::product_id.eq(id))
            .select(products::bottle_count)
            .first(conn)
            .optional()?;
        return Err(match current {
            None => RepositoryError::NotFound("Product not found".to_string()),
            Some(c) => RepositoryError::Conflict(format!(
                "Stock would become {}; it must stay between 0 and {} (currently {} available)",
                i64::from(c) + i64::from(delta),
                MAX_BOTTLE_COUNT,
                c
            )),
        });
    };

    Ok(StockLevel {
        bottle_count,
        reserved_bottles: reserved_bottles(conn, id)?,
    })
}

pub fn delete_product(conn: &mut PgConnection, id: &str) -> Result<(), RepositoryError> {
    use crate::schema::products::dsl::*;

    let target = products
        .filter(product_id.eq(id))
        .filter(deleted_at.is_null())
        .select(product_id)
        .first::<String>(conn)
        .optional()?;

    if target.is_none() {
        // Check if it exists but is already deleted
        let exists = products
            .filter(product_id.eq(id))
            .select(product_id)
            .first::<String>(conn)
            .optional()?
            .is_some();

        return Err(if exists {
            RepositoryError::Conflict("Product is already deleted".to_string())
        } else {
            RepositoryError::NotFound("Product not found".to_string())
        });
    }

    diesel::update(products)
        .filter(product_id.eq(id))
        .set(deleted_at.eq(Utc::now()))
        .execute(conn)
        .map(|_| ())
        .map_err(RepositoryError::from)
}

/// Returns `None` if no product with `id` exists, `Some(None)` if the product
/// exists and is active, `Some(Some(ts))` if the product exists and was
/// soft-deleted at `ts`.
fn load_deleted_at(
    conn: &mut PgConnection,
    id: &str,
) -> QueryResult<Option<Option<DateTime<Utc>>>> {
    use crate::schema::products::dsl::*;

    products
        .filter(product_id.eq(id))
        .select(deleted_at)
        .first::<Option<DateTime<Utc>>>(conn)
        .optional()
}

pub fn restore_product(conn: &mut PgConnection, id: &str) -> Result<Product, RepositoryError> {
    use crate::schema::products::dsl::*;

    match load_deleted_at(conn, id)? {
        None => return Err(RepositoryError::NotFound("Product not found".to_string())),
        Some(None) => {
            return Err(RepositoryError::BadRequest(
                "Product is not deleted".to_string(),
            ));
        }
        Some(Some(_)) => {}
    }

    diesel::update(products)
        .filter(product_id.eq(id))
        .set(deleted_at.eq(None::<DateTime<Utc>>))
        .returning(Product::as_returning())
        .get_result(conn)
        .map_err(RepositoryError::from)
}

pub fn hard_delete_product(conn: &mut PgConnection, id: &str) -> Result<(), RepositoryError> {
    use crate::schema::products::dsl::*;

    match load_deleted_at(conn, id)? {
        None => return Err(RepositoryError::NotFound("Product not found".to_string())),
        Some(None) => {
            return Err(RepositoryError::BadRequest(
                "Product has not been soft-deleted".to_string(),
            ));
        }
        Some(Some(ts)) => {
            // Mirror of `HARD_DELETE_GRACE_DAYS` in frontend/src/lib/constants.ts.
            let eligible_at = ts + Duration::days(7);
            if Utc::now() < eligible_at {
                return Err(RepositoryError::Conflict(format!(
                    "Product cannot be permanently deleted until {}",
                    eligible_at.format("%Y-%m-%dT%H:%M:%SZ")
                )));
            }
        }
    }

    // Orders reference the product (sales records must be kept), and lot rows
    // back the QR codes printed on bottles already sold. Either one means the
    // product stays archived instead of being erased.
    let order_lines: i64 = order_items::table
        .filter(order_items::product_id.eq(id))
        .count()
        .get_result(conn)?;
    let lot_rows: i64 = lots::table
        .filter(lots::product_id.eq(id))
        .count()
        .get_result(conn)?;
    if order_lines > 0 || lot_rows > 0 {
        return Err(RepositoryError::Conflict(format!(
            "Product cannot be permanently deleted: it has {order_lines} order line(s) and \
             {lot_rows} lot record(s) that must be kept. It stays archived."
        )));
    }

    diesel::delete(products)
        .filter(product_id.eq(id))
        .execute(conn)
        .map(|_| ())
        .map_err(RepositoryError::from)
}

#[derive(Debug, Clone, Copy, serde::Deserialize, Default, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IncludeDeleted {
    #[default]
    Active,
    Deleted,
    All,
}

#[derive(Debug, Default, Clone, Copy, serde::Deserialize, TS)]
#[ts(export)]
pub struct ProductFilters {
    pub in_stock: Option<bool>,
    pub product_type: Option<MeadType>,
    pub sweetness: Option<SweetnessType>,
    pub turbidity: Option<TurbidityType>,
    pub effervescence: Option<EffervescenceType>,
    pub acidity: Option<AcidityType>,
    pub tannins: Option<TanninsType>,
    pub body: Option<BodyType>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ListProductsOptions<'a> {
    pub include_deleted: IncludeDeleted,
    pub filters: ProductFilters,
    pub search: Option<&'a str>,
    pub order_by: Option<&'a str>,
    pub order_direction: Option<&'a str>,
}

/// Apply the shared product filter chain (deleted_at + 8 filters + search) to
/// any boxed query whose source includes the products table. Reassigns `$q`.
macro_rules! apply_product_filters {
    ($q:ident, $opts:expr) => {{
        use crate::schema::products::dsl as p;
        match $opts.include_deleted {
            IncludeDeleted::Active => $q = $q.filter(p::deleted_at.is_null()),
            IncludeDeleted::Deleted => $q = $q.filter(p::deleted_at.is_not_null()),
            IncludeDeleted::All => {}
        }
        if let Some(true) = $opts.filters.in_stock {
            $q = $q.filter(p::bottle_count.gt(0));
        }
        if let Some(v) = $opts.filters.product_type {
            $q = $q.filter(p::product_type.eq(v));
        }
        if let Some(v) = $opts.filters.sweetness {
            $q = $q.filter(p::sweetness.eq(v));
        }
        if let Some(v) = $opts.filters.turbidity {
            $q = $q.filter(p::turbidity.eq(v));
        }
        if let Some(v) = $opts.filters.effervescence {
            $q = $q.filter(p::effervescence.eq(v));
        }
        if let Some(v) = $opts.filters.acidity {
            $q = $q.filter(p::acidity.eq(v));
        }
        if let Some(v) = $opts.filters.tannins {
            $q = $q.filter(p::tannins.eq(v));
        }
        if let Some(v) = $opts.filters.body {
            $q = $q.filter(p::body.eq(v));
        }
        if let Some(s) = $opts.search {
            // Default ILIKE escape character is the backslash.
            let pattern = format!("%{}%", escape_like(s));
            $q = $q.filter(
                p::product_name
                    .ilike(pattern.clone())
                    .or(p::product_name_ro.ilike(pattern)),
            );
        }
    }};
}

/// Apply the order_by/order_direction pair if recognized, then always
/// `product_id` as a tie-breaker: LIMIT/OFFSET pagination over an unordered
/// (or tied) result can repeat or skip rows between pages.
macro_rules! apply_product_order {
    ($q:ident, $opts:expr) => {{
        use crate::schema::products::dsl as p;
        if let Some(col) = $opts.order_by {
            let desc = $opts.order_direction == Some("desc");
            $q = match col {
                "price" => {
                    if desc {
                        $q.order(p::price_ron.desc())
                    } else {
                        $q.order(p::price_ron.asc())
                    }
                }
                "volume" => {
                    if desc {
                        $q.order(p::bottle_size.desc())
                    } else {
                        $q.order(p::bottle_size.asc())
                    }
                }
                "bottling_date" => {
                    if desc {
                        $q.order(p::bottling_date.desc())
                    } else {
                        $q.order(p::bottling_date.asc())
                    }
                }
                _ => $q,
            };
        }
        $q = $q.then_order_by(p::product_id.asc());
    }};
}

pub fn count_products(conn: &mut PgConnection, opts: &ListProductsOptions<'_>) -> QueryResult<i64> {
    use crate::schema::products::dsl::products;

    let mut query = products.into_boxed();
    apply_product_filters!(query, opts);
    query.count().get_result(conn)
}

pub fn list_products(
    conn: &mut PgConnection,
    opts: &ListProductsOptions<'_>,
    limit: i64,
    offset: i64,
) -> QueryResult<Vec<ProductWithImage>> {
    use crate::schema::images::dsl::images;
    use crate::schema::products::dsl::products;

    let mut query = products.left_join(images).into_boxed();
    apply_product_filters!(query, opts);
    apply_product_order!(query, opts);

    query
        .select(ProductWithImage::as_select())
        .limit(limit)
        .offset(offset)
        .load(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_terms_are_trimmed_and_blank_means_none() {
        assert_eq!(
            normalize_search_term("  apricot ").unwrap(),
            Some("apricot")
        );
        assert_eq!(normalize_search_term("   ").unwrap(), None);
        assert!(normalize_search_term(&"ă".repeat(100)).is_ok());
        assert!(normalize_search_term(&"a".repeat(101)).is_err());
    }

    #[test]
    fn like_metacharacters_are_escaped() {
        assert_eq!(escape_like("50%_off\\"), "50\\%\\_off\\\\");
        assert_eq!(escape_like("miere"), "miere");
    }
}
