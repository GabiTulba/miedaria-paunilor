use crate::models::{AdminUser, NewAdminUser, NewUser, User};
use crate::schema::*;
use crate::utils;
use diesel::prelude::*;
use rand::distr::{Alphanumeric, SampleString};

fn create_salt_and_hash(password: &str) -> (String, String) {
    let new_salt = Alphanumeric.sample_string(&mut rand::rng(), 32);
    let hash = utils::salt_and_hash(&new_salt, password);

    (new_salt, hash)
}

pub fn create_admin(
    conn: &mut PgConnection,
    username: &str,
    password: &str,
) -> QueryResult<AdminUser> {
    let (new_salt, hash) = create_salt_and_hash(&password);

    let new_user = NewAdminUser {
        username: &username,
        salt: &new_salt,
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
            let (new_salt, hash) = create_salt_and_hash(new_password);

            diesel::update(admin_users::table)
                .filter(admin_users::username.eq(user))
                .set((
                    admin_users::salt.eq(new_salt),
                    admin_users::hashed_password.eq(hash),
                ))
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
    let (new_salt, hash) = create_salt_and_hash(&password);

    let new_user = NewUser {
        username: &username,
        salt: &new_salt,
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
            let (new_salt, hash) = create_salt_and_hash(new_password);

            diesel::update(users::table)
                .filter(users::username.eq(user))
                .set((users::salt.eq(new_salt), users::hashed_password.eq(hash)))
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
