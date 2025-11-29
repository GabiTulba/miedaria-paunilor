pub mod models;
pub mod schema;
pub mod utils;
pub mod user_crud;
pub mod product_crud;

use diesel::prelude::*;
use dotenvy::dotenv;
use std::env;

pub fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
     PgConnection::establish(&database_url)
        .unwrap_or_else(|_| panic!("Error connecting to {}", database_url))
}


// pub fn () {
//     use backend::schema::posts::dsl::*;

//     let connection = &mut establish_connection();
//     let results = posts
//         .filter(published.eq(true))
//         .limit(5)
//         .select(Post::as_select())
//         .load(connection)
//         .expect("Error loading posts");

//     println!("Displaying {} posts", results.len());
//     for post in results {
//         println!("{}", post.title);
//         println!("-----------\n");
//         println!("{}", post.body);
//     }
// }