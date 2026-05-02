use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    response::{AppendHeaders, IntoResponse},
    routing::{delete, get, post, put},
};
use diesel::r2d2::ConnectionManager;
use dotenvy::dotenv;
use std::{env, net::SocketAddr, sync::Arc};

use axum::extract::Extension;
use axum::extract::Multipart;
use backend::AppError;
use backend::blog_crud;
use backend::enum_crud;
use backend::image_crud;
use backend::language::Language;
use backend::localized::{LocalizedBlogPost, LocalizedProductWithImage};
use backend::models::PaginatedResponse;
use backend::product_crud::ProductWithImage;
use backend::sitemap_crud;
use backend::enums::*;
use backend::product_crud::IncludeDeleted;
use backend::{AppState, auth, build_login_limiter, db, models, product_crud};

struct Config {
    database_url: String,
    allowed_origin: String,
    backend_port: u16,
    jwt_secret: String,
    jwt_expiration_hours: i64,
    image_upload_dir: String,
}

impl Config {
    fn from_env() -> Result<Self, String> {
        let mut missing = Vec::<&str>::new();

        macro_rules! require {
            ($name:literal) => {
                env::var($name).unwrap_or_else(|_| {
                    missing.push($name);
                    String::new()
                })
            };
        }

        let database_url = require!("DATABASE_URL");
        let allowed_origin = require!("ALLOWED_ORIGIN");
        let backend_port_str = require!("BACKEND_PORT");
        let jwt_secret = require!("JWT_SECRET");
        let jwt_expiration_hours_str = require!("JWT_EXPIRATION_HOURS");
        let image_upload_dir = require!("IMAGE_UPLOAD_DIR");

        if !missing.is_empty() {
            return Err(format!(
                "Missing required environment variables: {}",
                missing.join(", ")
            ));
        }

        let backend_port = backend_port_str
            .parse::<u16>()
            .map_err(|_| "BACKEND_PORT must be a valid port number (0-65535)".to_string())?;

        let jwt_expiration_hours = jwt_expiration_hours_str
            .parse::<i64>()
            .map_err(|_| "JWT_EXPIRATION_HOURS must be a valid integer".to_string())?;

        Ok(Config {
            database_url,
            allowed_origin,
            backend_port,
            jwt_secret,
            jwt_expiration_hours,
            image_upload_dir,
        })
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=info,tower_http=info".parse().unwrap()),
        )
        .init();

    let config = Config::from_env().unwrap_or_else(|e| {
        tracing::error!("{}", e);
        std::process::exit(1);
    });

    use axum::http::HeaderValue;
    use tower_http::cors::Any;
    use tower_http::cors::CorsLayer;

    let manager = ConnectionManager::<diesel::pg::PgConnection>::new(&config.database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.");

    let allowed_origin = config
        .allowed_origin
        .parse::<HeaderValue>()
        .expect("ALLOWED_ORIGIN is not a valid header value");

    let app_state = Arc::new(AppState {
        pool,
        login_limiter: build_login_limiter(),
        site_url: config.allowed_origin.clone(),
        jwt_secret: config.jwt_secret,
        jwt_expiration_hours: config.jwt_expiration_hours,
        image_upload_dir: config.image_upload_dir,
    });

    let cors = CorsLayer::new()
        .allow_origin(allowed_origin)
        .allow_methods(Any)
        .allow_headers(Any)
        .expose_headers([axum::http::header::VARY]);

    let admin_routes = Router::new()
        .route("/protected", get(protected_route))
        .route("/products", get(list_products_admin).post(create_product))
        .route("/products/{product_id}", get(get_product_by_id_admin).put(update_product).delete(delete_product))
        .route("/products/{product_id}/restore", post(restore_product_handler))
        .route("/products/{product_id}/hard", delete(hard_delete_product_handler))
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
        .route("/api/blog/{slug}", get(get_blog_post_by_slug))
        .route("/api/sitemap-data", get(get_sitemap_data))
        .route("/api/admin/login", post(auth::login))
        .nest("/api/admin", admin_routes)
        .with_state(app_state)
        .layer(DefaultBodyLimit::max(52_428_800)) // 50MB limit
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
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
    image_crud::upload_image(&mut conn, multipart, &app_state.image_upload_dir).await
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
    image_crud::update_image(&mut conn, image_id, updated_image, &app_state.image_upload_dir).await
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
    tannins: Option<TanninsType>,
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

type VaryLang = AppendHeaders<[(axum::http::HeaderName, &'static str); 1]>;

fn vary_accept_language() -> VaryLang {
    AppendHeaders([(axum::http::header::VARY, "Accept-Language")])
}

async fn get_all_products(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetProductsQuery>,
    lang: Language,
) -> Result<(VaryLang, Json<PaginatedResponse<LocalizedProductWithImage>>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let per_page = query.per_page.unwrap_or(20).min(100) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query.limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);

    let total_count = product_crud::count_all_products(
        &mut conn,
        query.in_stock,
        query.product_type,
        query.sweetness,
        query.turbidity,
        query.effervescence,
        query.acidity,
        query.tannins,
        query.body,
    )?;

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
        query.tannins,
        query.body,
        limit,
        offset,
    )?;

    let items: Vec<_> = products
        .into_iter()
        .map(|p| LocalizedProductWithImage::from_product_with_image(p, lang))
        .collect();

    let total_pages = (total_count as u64).div_ceil(per_page as u64);

    Ok((vary_accept_language(), Json(PaginatedResponse { items, total_pages })))
}

async fn get_product_by_id(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    lang: Language,
) -> Result<(VaryLang, Json<LocalizedProductWithImage>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::get_product(&mut conn, &product_id)?.ok_or(AppError::NotFound(
        format!("Product with id {} not found", product_id),
    ))?;

    Ok((
        vary_accept_language(),
        Json(LocalizedProductWithImage::from_product_with_image(product, lang)),
    ))
}

async fn get_product_by_id_admin(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<ProductWithImage>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let product = product_crud::get_product_admin(&mut conn, &product_id)?.ok_or(
        AppError::NotFound(format!("Product with id {} not found", product_id)),
    )?;

    Ok(Json(product))
}

async fn protected_route(Extension(claims): Extension<auth::Claims>) -> Result<String, StatusCode> {
    Ok(format!("Welcome to the protected area, {}!", claims.sub))
}

#[derive(Debug, serde::Deserialize)]
pub struct GetAdminProductsQuery {
    include_deleted: Option<IncludeDeleted>,
    order_by: Option<String>,
    in_stock: Option<bool>,
    order_direction: Option<String>,
    product_type: Option<MeadType>,
    sweetness: Option<SweetnessType>,
    turbidity: Option<TurbidityType>,
    effervescence: Option<EffervescenceType>,
    acidity: Option<AcidityType>,
    tannins: Option<TanninsType>,
    body: Option<BodyType>,
    page: Option<u32>,
    per_page: Option<u32>,
    limit: Option<u32>,
}

async fn list_products_admin(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetAdminProductsQuery>,
) -> Result<Json<PaginatedResponse<product_crud::ProductWithImage>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;

    let per_page = query.per_page.unwrap_or(20).min(100) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query
        .limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);

    let include_deleted = query.include_deleted.unwrap_or_default();

    let total_count = product_crud::count_all_products_admin(
        &mut conn,
        include_deleted,
        query.in_stock,
        query.product_type,
        query.sweetness,
        query.turbidity,
        query.effervescence,
        query.acidity,
        query.tannins,
        query.body,
    )?;

    let items = product_crud::get_all_products_admin(
        &mut conn,
        include_deleted,
        query.order_by.as_deref(),
        query.in_stock,
        query.order_direction.as_deref(),
        query.product_type,
        query.sweetness,
        query.turbidity,
        query.effervescence,
        query.acidity,
        query.tannins,
        query.body,
        limit,
        offset,
    )?;

    let total_pages = (total_count as u64).div_ceil(per_page as u64);

    Ok(Json(PaginatedResponse { items, total_pages }))
}

async fn restore_product_handler(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<Json<models::Product>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let product = product_crud::restore_product(&mut conn, &product_id)?;
    Ok(Json(product))
}

async fn hard_delete_product_handler(
    State(app_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    product_crud::hard_delete_product(&mut conn, &product_id)?;
    Ok(StatusCode::NO_CONTENT)
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
    product_crud::delete_product(&mut conn, &product_id)?;
    Ok(StatusCode::NO_CONTENT)
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
    lang: Language,
) -> Result<(VaryLang, Json<PaginatedResponse<LocalizedBlogPost>>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let per_page = query.per_page.unwrap_or(10).min(50) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query.limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);
    let total_count = blog_crud::count_all_blog_posts(&mut conn)?;
    let posts = blog_crud::get_all_blog_posts(&mut conn, limit, offset)?;
    let items: Vec<_> = posts
        .into_iter()
        .map(|p| LocalizedBlogPost::from_blog_post(p, lang))
        .collect();
    let total_pages = (total_count as u64).div_ceil(per_page as u64);
    Ok((vary_accept_language(), Json(PaginatedResponse { items, total_pages })))
}

async fn get_all_blog_posts_admin(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetBlogPostsQuery>,
) -> Result<Json<PaginatedResponse<models::BlogPost>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let per_page = query.per_page.unwrap_or(10).min(50) as i64;
    let page = query.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * per_page;
    let limit = query.limit
        .map(|l| (l as i64).min(per_page + 1))
        .unwrap_or(per_page);
    let total_count = blog_crud::count_all_blog_posts_admin(&mut conn)?;
    let items = blog_crud::get_all_blog_posts_admin(&mut conn, limit, offset)?;
    let total_pages = (total_count as u64).div_ceil(per_page as u64);
    Ok(Json(PaginatedResponse { items, total_pages }))
}

async fn get_blog_post_by_slug(
    State(app_state): State<Arc<AppState>>,
    Path(slug): Path<String>,
    lang: Language,
) -> Result<(VaryLang, Json<LocalizedBlogPost>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let post = blog_crud::get_blog_post_by_slug(&mut conn, &slug)?;
    Ok((
        vary_accept_language(),
        Json(LocalizedBlogPost::from_blog_post(post, lang)),
    ))
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
