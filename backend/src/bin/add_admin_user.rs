use backend::db::establish_connection;
use backend::models::AdminUser;
use backend::{create_admin, get_admin, verify_password};
use diesel::PgConnection;
use std::env::args;

// Throws if there already is a user $ADMIN_USERNAME in the database with a different password than $ADMIN_PASSWORD
pub fn create_admin_user_if_non_existent_or_die(
    conn: &mut PgConnection,
    username: &str,
    password: &str,
) -> Option<AdminUser> {
    match get_admin(conn, username) {
        Ok(Some(user)) => {
            if !verify_password(password, &user.hashed_password) {
                panic!("User already exists with different password");
            } else {
                None
            }
        }
        Ok(None) => {
            match create_admin(conn, username, password) {
                Ok(user) => Some(user),
                Err(e) => panic!("Error creating user: {}", e),
            }
        }
        Err(e) => panic!("Error fetching user: {}", e),
    }
}

fn main() {
    let username = args().nth(1).expect("add_admin_user requires a username");
    let password = args().nth(2).expect("add_admin_user requires a password");

    let conn = &mut establish_connection();

    let new_user = create_admin_user_if_non_existent_or_die(conn, &username, &password);

    match new_user {
        Some(user) => {
            println!("Created new admin user {}", user.username)
        }
        None => {
            println!("Admin user already exists");
        }
    }
}
