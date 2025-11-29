use diesel::prelude::*;
use crate::models::{Product, NewProduct};
use crate::schema::*;

use diesel::result::{Error as DieselError, DatabaseErrorKind};

#[derive(Debug)]
pub enum ProductCreationError {
    DuplicateProductId,
    DatabaseError(String), // For other database errors
    UnknownError,
}

impl From<DieselError> for ProductCreationError {
    fn from(error: DieselError) -> Self {
        match error {
            DieselError::DatabaseError(kind, info) => {
                if let DatabaseErrorKind::UniqueViolation = kind {
                    // Assuming the constraint for product_id unique violation.
                    // Diesel's `info` might contain the constraint name, but checking for UniqueViolation is usually sufficient.
                    // For more specific checks, `info.constraint_name()` could be used if available and reliable.
                    if let Some(constraint_name) = info.constraint_name() {
                        if constraint_name == "products_product_id_key" { // This is an assumed constraint name. Realistically, it should be checked from migrations.
                            return ProductCreationError::DuplicateProductId;
                        }
                    } else {
                        // If constraint name is not available, but it's a unique violation,
                        // we might still treat it as DuplicateProductId if the context implies it.
                        // For simplicity, let's assume if it's a UniqueViolation and we can't get a name, it's generic.
                    }
                }
                ProductCreationError::DatabaseError(format!("{:?} - {:?}", kind, info))
            },
            _ => ProductCreationError::UnknownError,
        }
    }
}

pub fn create_product(conn: &mut PgConnection, new_product: &NewProduct) -> Result<Product, ProductCreationError> {
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

pub fn update_product(conn: &mut PgConnection, new_product: &Product) -> QueryResult<()> {
    match get_product(conn, new_product.product_id.as_str())? {
        Some (_product) => {
            diesel::update(products::table)
            .filter(products::product_id.eq(new_product.product_id.as_str()))
            .set(new_product)
            .execute(conn)
            .map(|_| ())
        }
        None => Err(diesel::result::Error::NotFound)
    }
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