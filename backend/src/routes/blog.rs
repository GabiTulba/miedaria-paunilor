use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
};

use crate::AppError;
use crate::AppState;
use crate::blog_crud;
use crate::db;
use crate::language::Language;
use crate::localized::LocalizedBlogPost;
use crate::models::{self, PaginatedResponse};
use crate::pagination::{self, PageQuery};

use super::{VaryLang, vary_accept_language};

#[derive(Debug, serde::Deserialize)]
struct GetBlogPostsQuery {
    page: Option<u32>,
    per_page: Option<u32>,
}

impl GetBlogPostsQuery {
    fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page,
            per_page: self.per_page,
        }
    }
}

async fn get_all_blog_posts(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetBlogPostsQuery>,
    lang: Language,
) -> Result<(VaryLang, Json<PaginatedResponse<LocalizedBlogPost>>), AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let page = query.page_query().resolve(10, 50);
    let total_count = blog_crud::count_all_blog_posts(&mut conn)?;
    let posts = blog_crud::get_all_blog_posts(&mut conn, page.limit, page.offset)?;
    let items: Vec<_> = posts
        .into_iter()
        .map(|p| LocalizedBlogPost::from_blog_post(p, lang))
        .collect();
    let total_pages = pagination::total_pages(total_count, page.per_page);
    Ok((
        vary_accept_language(),
        Json(PaginatedResponse { items, total_pages }),
    ))
}

async fn get_all_blog_posts_admin(
    State(app_state): State<Arc<AppState>>,
    query: Query<GetBlogPostsQuery>,
) -> Result<Json<PaginatedResponse<models::BlogPost>>, AppError> {
    let mut conn = db::get_db_connection(&app_state)?;
    let page = query.page_query().resolve(10, 50);
    let total_count = blog_crud::count_all_blog_posts_admin(&mut conn)?;
    let items = blog_crud::get_all_blog_posts_admin(&mut conn, page.limit, page.offset)?;
    let total_pages = pagination::total_pages(total_count, page.per_page);
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

/// Routes mounted at `/api/...` (public, rate-limited via `public_api_rate_limit`).
pub fn public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/blog", get(get_all_blog_posts))
        .route("/api/blog/{slug}", get(get_blog_post_by_slug))
}

/// Routes mounted under `/api/admin/...`.
pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/blog", post(create_blog_post))
        .route("/blog/{id}", put(update_blog_post))
        .route("/blog/{id}", delete(delete_blog_post))
        .route("/blog/admin", get(get_all_blog_posts_admin))
}
