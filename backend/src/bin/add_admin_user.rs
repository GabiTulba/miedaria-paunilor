use diesel::prelude::*;
use std::env::args;
use backend::*;
use self::models::AdminUser;


// Throws if there already is a user $ADMIN_USERNAME in the database with a different password than $ADMIN_PASSWORD
pub fn create_admin_user_if_non_existent_or_die(conn: &mut PgConnection, username:&str, password: &str) -> Option<AdminUser> {
    match user_crud::get_admin(conn, &username) {
        Ok (Some(user)) => {
            if user.hashed_password != utils::salt_and_hash(&user.salt, &password) {
                panic!("User already exists with different password");
            } else {
                None
            }
        },
        Ok(None) => {
            match user_crud::create_admin(conn, &username, &password) {
                Ok(user) => Some (user),
                Err(e) => panic!("Error creating user: {}", e),
            }
        }
        Err(e) => panic!("Error fetching user: {}", e),
    }
}

fn main() {
    let conn = &mut establish_connection();

    let username = args().nth(1).expect("add_admin_user requires a username");
    let password = args().nth(2).expect("add_admin_user requires a password");


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