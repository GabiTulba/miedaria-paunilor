use crate::error::RepositoryError;
use crate::schema::site_settings;
use diesel::prelude::*;

const CHECKOUT_ENABLED_KEY: &str = "checkout_enabled";

/// Missing row means enabled: the migration seeds `true`, and failing open
/// matches that default rather than silently closing the shop.
pub fn is_checkout_enabled(conn: &mut PgConnection) -> Result<bool, RepositoryError> {
    let value: Option<String> = site_settings::table
        .filter(site_settings::setting_key.eq(CHECKOUT_ENABLED_KEY))
        .select(site_settings::setting_value)
        .first(conn)
        .optional()?;
    Ok(value.as_deref() != Some("false"))
}

pub fn set_checkout_enabled(conn: &mut PgConnection, enabled: bool) -> Result<(), RepositoryError> {
    let value = if enabled { "true" } else { "false" };
    diesel::insert_into(site_settings::table)
        .values((
            site_settings::setting_key.eq(CHECKOUT_ENABLED_KEY),
            site_settings::setting_value.eq(value),
        ))
        .on_conflict(site_settings::setting_key)
        .do_update()
        .set(site_settings::setting_value.eq(value))
        .execute(conn)?;
    Ok(())
}
