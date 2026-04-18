use crate::models::{AdminUser, NewAdminUser, NewUser, User};
use crate::schema::*;
use crate::utils;
use diesel::prelude::*;

pub fn create_admin(
    conn: &mut PgConnection,
    username: &str,
    password: &str,
) -> QueryResult<AdminUser> {
    let hash = utils::hash_password(password);

    let new_user = NewAdminUser {
        username,
        hashed_password: &hash,
    };

    diesel::insert_into(admin_users::table)
        .values(&new_user)
        .returning(AdminUser::as_returning())
        .get_result(conn)
}

pub fn get_admin(conn: &mut PgConnection, user: &str) -> QueryResult<Option<AdminUser>> {
    use crate::schema::admin_users::dsl::*;

    admin_users
        .find(user)
        .select(AdminUser::as_select())
        .first(conn)
        .optional()
}

pub fn update_admin_password(
    conn: &mut PgConnection,
    user: &str,
    new_password: &str,
) -> QueryResult<()> {
    match get_admin(conn, user)? {
        Some(_user) => {
            let hash = utils::hash_password(new_password);

            diesel::update(admin_users::table)
                .filter(admin_users::username.eq(user))
                .set(admin_users::hashed_password.eq(hash))
                .execute(conn)
                .map(|_| ())
        }
        None => Err(diesel::result::Error::NotFound),
    }
}

pub fn delete_admin(conn: &mut PgConnection, user: &str) -> QueryResult<()> {
    diesel::delete(admin_users::table)
        .filter(admin_users::username.eq(user))
        .execute(conn)
        .map(|_| ())
}

pub fn create_regular(
    conn: &mut PgConnection,
    username: &str,
    password: &str,
) -> QueryResult<User> {
    let hash = utils::hash_password(password);

    let new_user = NewUser {
        username,
        hashed_password: &hash,
    };

    diesel::insert_into(users::table)
        .values(&new_user)
        .returning(User::as_returning())
        .get_result(conn)
}

pub fn get_regular(conn: &mut PgConnection, user: &str) -> QueryResult<Option<User>> {
    use crate::schema::users::dsl::*;

    users
        .find(user)
        .select(User::as_select())
        .first(conn)
        .optional()
}

pub fn update_regular_password(
    conn: &mut PgConnection,
    user: &str,
    new_password: &str,
) -> QueryResult<()> {
    match get_regular(conn, user)? {
        Some(_user) => {
            let hash = utils::hash_password(new_password);

            diesel::update(users::table)
                .filter(users::username.eq(user))
                .set(users::hashed_password.eq(hash))
                .execute(conn)
                .map(|_| ())
        }
        None => Err(diesel::result::Error::NotFound),
    }
}

pub fn delete_regular(conn: &mut PgConnection, user: &str) -> QueryResult<()> {
    diesel::delete(users::table)
        .filter(users::username.eq(user))
        .execute(conn)
        .map(|_| ())
}
