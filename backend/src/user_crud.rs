use crate::models::{AdminUser, NewAdminUser, NewUser, User};
use crate::schema::*;
use crate::utils;
use diesel::prelude::*;

macro_rules! impl_user_crud {
    (
        create = $create:ident,
        get = $get:ident,
        update_password = $update:ident,
        delete = $delete:ident,
        table = $table:ident,
        model = $model:ty,
        new_model = $new_model:ident $(,)?
    ) => {
        pub fn $create(
            conn: &mut PgConnection,
            username: &str,
            password: &str,
        ) -> QueryResult<$model> {
            let hash = utils::hash_password(password);
            let new_user = $new_model {
                username,
                hashed_password: &hash,
            };
            diesel::insert_into($table::table)
                .values(&new_user)
                .returning(<$model>::as_returning())
                .get_result(conn)
        }

        pub fn $get(conn: &mut PgConnection, user: &str) -> QueryResult<Option<$model>> {
            $table::table
                .find(user)
                .select(<$model>::as_select())
                .first(conn)
                .optional()
        }

        pub fn $update(
            conn: &mut PgConnection,
            user: &str,
            new_password: &str,
        ) -> QueryResult<()> {
            match $get(conn, user)? {
                Some(_) => {
                    let hash = utils::hash_password(new_password);
                    diesel::update($table::table)
                        .filter($table::username.eq(user))
                        .set($table::hashed_password.eq(hash))
                        .execute(conn)
                        .map(|_| ())
                }
                None => Err(diesel::result::Error::NotFound),
            }
        }

        pub fn $delete(conn: &mut PgConnection, user: &str) -> QueryResult<()> {
            diesel::delete($table::table)
                .filter($table::username.eq(user))
                .execute(conn)
                .map(|_| ())
        }
    };
}

impl_user_crud!(
    create = create_admin,
    get = get_admin,
    update_password = update_admin_password,
    delete = delete_admin,
    table = admin_users,
    model = AdminUser,
    new_model = NewAdminUser,
);

impl_user_crud!(
    create = create_regular,
    get = get_regular,
    update_password = update_regular_password,
    delete = delete_regular,
    table = users,
    model = User,
    new_model = NewUser,
);
