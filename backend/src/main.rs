use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
};
use diesel::r2d2::ConnectionManager;
use dotenvy::dotenv;
use std::{env, net::SocketAddr, sync::Arc};

// Import everything from the backend library crate
use axum::extract::Extension;
use axum::extract::Multipart; // Added for upload_image_handler
use backend::AppError;
use backend::blog_crud;
use backend::enum_crud;
use backend::image_crud;
use backend::product_crud::ProductWithImage;
use backend::sitemap_crud;
use backend::enums::*;
use backend::{AppState, auth, build_login_limiter, db, models, product_crud};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=info,tower_http=info".parse().unwrap()),
        )
        .init();

    use axum::http::HeaderValue;
    use tower_http::cors::Any;
    use tower_http::cors::CorsLayer;

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<diesel::pg::PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.");

    let allowed_origin_str = env::var("ALLOWED_ORIGIN").expect("ALLOWED_ORIGIN must be set");
    let allowed_origin = allowed_origin_str
        .parse::<HeaderValue>()
        .expect("ALLOWED_ORIGIN is not a valid header value");

    let app_state = Arc::new(AppState {
        pool,
        login_limiter: build_login_limiter(),
        site_url: allowed_origin_str,
    });

    let cors = CorsLayer::new()
        .allow_origin(allowed_origin)
        .allow_methods(Any)
        .allow_headers(Any);

    let admin_routes = Router::new()
        .route("/protected", get(protected_route))
        .route("/products", post(create_product))
        .route("/products/{product_id}", put(update_product))
        .route("/products/{product_id}", delete(delete_product))
        .route("/blog", post(create_blog_post))
        .route("/blog/{id}", put(update_blog_post))
        .route("/blog/{id}", delete(delete_blog_post))
        .route("/blog/admin", get(get_all_blog_posts_admin))
        .route("/images", get(list_images))
        .route("/images", post(upload_image_handler)) // Updated to use wrapper
        .route("/images/{image_id}", put(update_image_meta_handler)) // Updated to use wrapper
        .route("/images/{image_id}", delete(delete_image_wrapper)) // Updated to use wrapper
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth::auth_middleware,
        ))
        .layer(cors.clone());

    let app = Router::new()
        .route("/images/{image_id}", get(serve_image_handler)) // Updated to use wrapper
        .route("/health", get(health_check))
        .route("/api/enums", get(get_enum_values))
        .route("/api/products", get(get_all_products))
        .route("/api/products/{product_id}", get(get_product_by_id))
        .route("/api/blog", get(get_all_blog_posts))
        .route("/api/blog/{blog_id}", get(get_blog_post_by_blog_id))
        .route("/api/sitemap-data", get(get_sitemap_data))
        .route("/api/admin/login", post(auth::login))
        .nest("/api/admin", admin_routes)
        .with_state(app_state)
        .layer(DefaultBodyLimit::max(52_428_800)) // 50MB limit
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let port = env::var("BACKEND_PORT")
        .expect("BACKEND_PORT must be set")
        .parse::<u16>()
        .expect("BACKEND_PORT must be a valid port number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("listening on {}", addr);
    axum::serve(listener, app.into_make_service()).await?;
    Ok(())
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn get_enum_values() -> Result<Json<enum_crud::EnumValues>, AppError> {
    let enum_values = enum_crud::get_all_enum_values();
    Ok(Json(enum_values))
}

async fn upload_image_handler(
    State(app_state): State<Arc<AppState>>,
    multipart: Multipart,
) -> Result<Json<models::Image>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::upload_image(&mut conn, multipart).await
}

async fn serve_image_handler(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let (headers, content) = image_crud::serve_image(&mut conn, image_id).await?;
    Ok((headers, content))
}

async fn update_image_meta_handler(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
    Json(updated_image): Json<models::UpdateImage>,
) -> Result<Json<models::Image>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::update_image(&mut conn, image_id, updated_image).await
}

async fn delete_image_wrapper(
    State(app_state): State<Arc<AppState>>,
    Path(image_id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::delete_image(&mut conn, image_id).await
}

#[derive(Debug, serde::Deserialize)]
pub struct GetProductsQuery {
    order_by: Option<String>,
    in_stock: Option<bool>,
    order_direction: Option<String>,
    product_type: Option<MeadType>,
    sweetness: Option<SweetnessType>,
    turbidity: Option<TurbidityType>,
    effervescence: Option<EffervescenceType>,
    acidity: Option<AcidityType>,
    tanins: Option<TaninsType>,
    body: Option<BodyType>,
    page: Option<u32>,
    per_page: Option<u32>,
    limit: Option<u32>,
}

#[derive(Debug, serde::Deserialize)]
pub struct GetBlogPostsQuery {
    page: Option<u32>,
    per_page: Option<u32>,
    limit: Option<u32>,
}

async fn get_all_products(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetProductsQuery>,
) -> Result<Json<Vec<ProductWithImage>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let per_page = query.per_page.unwrap_or(20).min(100) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query.limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);

    let products = product_crud::get_all_products(
        &mut conn,
        query.order_by.as_deref(),
        query.in_stock,
        query.order_direction.as_deref(),
        query.product_type,
        query.sweetness,
        query.turbidity,
        query.effervescence,
        query.acidity,
        query.tanins,
        query.body,
        limit,
        offset,
    )?;

    Ok(Json(products))
}

async fn get_product_by_id(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<ProductWithImage>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::get_product(&mut conn, &product_id)?.ok_or(AppError::NotFound(
        format!("Product with id {} not found", product_id),
    ))?;

    Ok(Json(product))
}

async fn protected_route(Extension(claims): Extension<auth::Claims>) -> Result<String, StatusCode> {
    Ok(format!("Welcome to the protected area, {}!", claims.sub))
}

async fn create_product(
    State(app_state): State<Arc<AppState>>,
    Json(new_product): Json<models::NewProduct>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::create_product(&mut conn, &new_product)?;

    Ok(Json(product))
}

async fn update_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(mut product): Json<models::Product>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    product.product_id = product_id;

    let updated_product = product_crud::update_product(&mut conn, &product)?;

    Ok(Json(updated_product))
}

async fn delete_product(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    product_crud::delete_product(&mut conn, &product_id)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(AppError::from)
}

async fn list_images(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<Vec<models::Image>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    image_crud::get_all_images(&mut conn).await
}

async fn get_all_blog_posts(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetBlogPostsQuery>,
) -> Result<Json<Vec<models::BlogPost>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let per_page = query.per_page.unwrap_or(10).min(50) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query.limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);
    let posts = blog_crud::get_all_blog_posts(&mut conn, limit, offset)?;
    Ok(Json(posts))
}

async fn get_all_blog_posts_admin(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetBlogPostsQuery>,
) -> Result<Json<Vec<models::BlogPost>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let per_page = query.per_page.unwrap_or(10).min(50) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query.limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);
    let posts = blog_crud::get_all_blog_posts_admin(&mut conn, limit, offset)?;
    Ok(Json(posts))
}

async fn get_blog_post_by_blog_id(
    State(app_state): State<Arc<AppState>>,
    Path(blog_id): Path<String>,
) -> Result<Json<models::BlogPost>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let post = blog_crud::get_blog_post_by_blog_id(&mut conn, &blog_id)?;
    Ok(Json(post))
}

async fn get_sitemap_data(
    State(app_state): State<Arc<AppState>>,
) -> Result<Json<sitemap_crud::SitemapData>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let sitemap_data = sitemap_crud::get_sitemap_data(&mut conn, &app_state.site_url)?;
    Ok(Json(sitemap_data))
}

async fn create_blog_post(
    State(app_state): State<Arc<AppState>>,
    Json(new_post): Json<models::NewBlogPost>,
) -> Result<Json<models::BlogPost>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let post = blog_crud::create_blog_post(&mut conn, new_post)?;
    Ok(Json(post))
}

async fn update_blog_post(
    State(app_state): State<Arc<AppState>>,
    Path(blog_id): Path<uuid::Uuid>,
    Json(update_post): Json<models::UpdateBlogPost>,
) -> Result<Json<models::BlogPost>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let post = blog_crud::update_blog_post(&mut conn, blog_id, update_post)?;
    Ok(Json(post))
}

async fn delete_blog_post(
    State(app_state): State<Arc<AppState>>,
    Path(blog_id): Path<uuid::Uuid>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    blog_crud::delete_blog_post(&mut conn, blog_id)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(AppError::from)
}
