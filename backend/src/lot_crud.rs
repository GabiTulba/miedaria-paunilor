use crate::error::RepositoryError;
use crate::models::{Image, Lot, LotNutrition, LotUpsert, Product};
use crate::product_crud::ProductValidationError;
use diesel::prelude::*;

/// Row backing the public lot page: the frozen batch snapshot plus the live
/// product (bilingual/editorial data) and its image.
#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = crate::schema::lots)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct LotPageRow {
    #[diesel(embed)]
    pub lot: Lot,
    #[diesel(embed)]
    pub product: Product,
    #[diesel(embed)]
    pub image: Option<Image>,
}

/// Fetch everything the public lot page needs. Deliberately does NOT filter on
/// `products.deleted_at`: QR codes on already-sold bottles must keep resolving
/// after a product is retired; the caller exposes availability separately.
pub fn get_lot_page(conn: &mut PgConnection, number: i32) -> QueryResult<Option<LotPageRow>> {
    use crate::schema::images::dsl::images;
    use crate::schema::lots::dsl::*;
    use crate::schema::products::dsl::products;

    lots.inner_join(products.left_join(images))
        .filter(lot_number.eq(number))
        .select(LotPageRow::as_select())
        .first(conn)
        .optional()
}

/// Insert or refresh the lot row for `product`'s current lot number, inside
/// the caller's transaction. A lot owned by a different product is a
/// validation error. Re-saving a product updates its batch in place; saving
/// with a new lot number inserts a new row and leaves previous rows untouched,
/// which is what keeps old QR codes working (batch history).
pub fn upsert_lot(
    conn: &mut PgConnection,
    product: &Product,
    nutrition: &LotNutrition,
) -> Result<(), RepositoryError> {
    use crate::schema::lots::dsl::*;

    // Lock the existing row so the ownership check and the upsert below are
    // atomic with respect to concurrent saves.
    let owner = lots
        .filter(lot_number.eq(product.lot_number))
        .select(product_id)
        .for_update()
        .first::<String>(conn)
        .optional()?;

    if owner.is_some_and(|o| o != product.product_id) {
        return Err(RepositoryError::ProductValidation(vec![
            ProductValidationError::LotNumberInUse,
        ]));
    }

    let upsert = LotUpsert {
        lot_number: product.lot_number,
        product_id: &product.product_id,
        bottling_date: product.bottling_date,
        abv: product.abv,
        nutrition: nutrition.clone(),
    };

    diesel::insert_into(lots)
        .values(&upsert)
        .on_conflict(lot_number)
        .do_update()
        .set(&upsert)
        .execute(conn)?;

    Ok(())
}

/// Nutrition declaration for the lot matching `product`'s current lot number,
/// used to pre-fill the admin edit form. `None` for legacy products saved
/// before lots existed. The `product_id` filter guards against showing a
/// foreign product's data if lot numbers were ever inconsistent.
pub fn get_current_nutrition(
    conn: &mut PgConnection,
    product: &Product,
) -> QueryResult<Option<LotNutrition>> {
    use crate::schema::lots::dsl::*;

    lots.filter(lot_number.eq(product.lot_number))
        .filter(product_id.eq(&product.product_id))
        .select(LotNutrition::as_select())
        .first(conn)
        .optional()
}
