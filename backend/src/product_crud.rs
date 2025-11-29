use diesel::prelude::*;
use crate::models::{Product, NewProduct};
use crate::schema::*;

pub fn create_product(conn: &mut PgConnection, new_product: &NewProduct) -> QueryResult<Product> {
        diesel::insert_into(products::table)
        .values(new_product)
        .returning(Product::as_returning())
        .get_result(conn)
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