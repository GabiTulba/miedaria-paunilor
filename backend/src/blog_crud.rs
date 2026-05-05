use crate::models::{BlogPost, NewBlogPost, UpdateBlogPost};
use crate::schema::*;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use serde::Serialize;

const MAX_MARKDOWN_BYTES: usize = 200_000;

#[derive(Debug, Serialize)]
pub enum BlogValidationError {
    EmptyTitle,
    TitleTooLong,
    EmptyTitleRo,
    TitleRoTooLong,
    EmptySlug,
    SlugTooLong,
    InvalidSlug,
    EmptyContent,
    ContentTooLarge,
    EmptyContentRo,
    ContentRoTooLarge,
    EmptyExcerpt,
    ExcerptTooLong,
    EmptyExcerptRo,
    ExcerptRoTooLong,
    EmptyAuthor,
    AuthorTooLong,
}

#[derive(Debug)]
pub enum BlogCreationError {
    DuplicateSlug,
    DatabaseError(String),
    ValidationErrors(Vec<BlogValidationError>),
    UnknownError,
}

impl From<DieselError> for BlogCreationError {
    fn from(error: DieselError) -> Self {
        match error {
            DieselError::DatabaseError(kind, info) => {
                if let DatabaseErrorKind::UniqueViolation = kind {
                    if let Some(constraint_name) = info.constraint_name() {
                        if constraint_name.contains("slug") {
                            return BlogCreationError::DuplicateSlug;
                        }
                    }
                }
                BlogCreationError::DatabaseError(format!("{:?} - {:?}", kind, info))
            }
            _ => BlogCreationError::UnknownError,
        }
    }
}

#[derive(Debug)]
pub enum BlogUpdateError {
    NotFound,
    DuplicateSlug,
    DatabaseError(String),
    ValidationErrors(Vec<BlogValidationError>),
    UnknownError,
}

impl From<DieselError> for BlogUpdateError {
    fn from(error: DieselError) -> Self {
        match error {
            DieselError::NotFound => BlogUpdateError::NotFound,
            DieselError::DatabaseError(kind, info) => {
                if let DatabaseErrorKind::UniqueViolation = kind {
                    if let Some(constraint_name) = info.constraint_name() {
                        if constraint_name.contains("slug") {
                            return BlogUpdateError::DuplicateSlug;
                        }
                    }
                }
                BlogUpdateError::DatabaseError(format!("{:?} - {:?}", kind, info))
            }
            _ => BlogUpdateError::UnknownError,
        }
    }
}

fn validate_blog_post(new_post: &NewBlogPost) -> Vec<BlogValidationError> {
    let mut errors = Vec::new();

    if new_post.title.is_empty() {
        errors.push(BlogValidationError::EmptyTitle);
    } else if new_post.title.len() > 512 {
        errors.push(BlogValidationError::TitleTooLong);
    }

    if new_post.title_ro.is_empty() {
        errors.push(BlogValidationError::EmptyTitleRo);
    } else if new_post.title_ro.len() > 512 {
        errors.push(BlogValidationError::TitleRoTooLong);
    }

    if new_post.slug.is_empty() {
        errors.push(BlogValidationError::EmptySlug);
    } else if new_post.slug.len() > 256 {
        errors.push(BlogValidationError::SlugTooLong);
    } else if !crate::utils::is_valid_slug(&new_post.slug) {
        errors.push(BlogValidationError::InvalidSlug);
    }

    if new_post.content_markdown.is_empty() {
        errors.push(BlogValidationError::EmptyContent);
    } else if new_post.content_markdown.len() > MAX_MARKDOWN_BYTES {
        errors.push(BlogValidationError::ContentTooLarge);
    }

    if new_post.content_markdown_ro.is_empty() {
        errors.push(BlogValidationError::EmptyContentRo);
    } else if new_post.content_markdown_ro.len() > MAX_MARKDOWN_BYTES {
        errors.push(BlogValidationError::ContentRoTooLarge);
    }

    if new_post.excerpt.is_empty() {
        errors.push(BlogValidationError::EmptyExcerpt);
    } else if new_post.excerpt.len() > 1024 {
        errors.push(BlogValidationError::ExcerptTooLong);
    }

    if new_post.excerpt_ro.is_empty() {
        errors.push(BlogValidationError::EmptyExcerptRo);
    } else if new_post.excerpt_ro.len() > 1024 {
        errors.push(BlogValidationError::ExcerptRoTooLong);
    }

    if new_post.author.is_empty() {
        errors.push(BlogValidationError::EmptyAuthor);
    } else if new_post.author.len() > 256 {
        errors.push(BlogValidationError::AuthorTooLong);
    }

    errors
}

pub fn create_blog_post(
    conn: &mut PgConnection,
    mut new_post: NewBlogPost,
) -> Result<BlogPost, BlogCreationError> {
    if new_post.is_published {
        new_post.published_at = Some(chrono::Utc::now().naive_utc());
    }

    let validation_errors = validate_blog_post(&new_post);
    if !validation_errors.is_empty() {
        return Err(BlogCreationError::ValidationErrors(validation_errors));
    }

    diesel::insert_into(blog_posts::table)
        .values(&new_post)
        .get_result(conn)
        .map_err(BlogCreationError::from)
}

pub fn count_all_blog_posts(conn: &mut PgConnection) -> QueryResult<i64> {
    blog_posts::table
        .filter(blog_posts::is_published.eq(true))
        .count()
        .get_result(conn)
}

pub fn count_all_blog_posts_admin(conn: &mut PgConnection) -> QueryResult<i64> {
    blog_posts::table.count().get_result(conn)
}

pub fn get_all_blog_posts(
    conn: &mut PgConnection,
    limit: i64,
    offset: i64,
) -> Result<Vec<BlogPost>, DieselError> {
    blog_posts::table
        .filter(blog_posts::is_published.eq(true))
        .order_by(blog_posts::published_at.desc())
        .limit(limit)
        .offset(offset)
        .load::<BlogPost>(conn)
}

pub fn get_all_blog_posts_admin(
    conn: &mut PgConnection,
    limit: i64,
    offset: i64,
) -> Result<Vec<BlogPost>, DieselError> {
    blog_posts::table
        .order_by(blog_posts::published_at.desc())
        .limit(limit)
        .offset(offset)
        .load::<BlogPost>(conn)
}

pub fn get_blog_post_by_slug(
    conn: &mut PgConnection,
    slug: &str,
) -> Result<BlogPost, DieselError> {
    blog_posts::table
        .filter(blog_posts::slug.eq(slug))
        .filter(blog_posts::is_published.eq(true))
        .first::<BlogPost>(conn)
}

pub fn get_blog_post_by_id(
    conn: &mut PgConnection,
    id: uuid::Uuid,
) -> Result<BlogPost, DieselError> {
    blog_posts::table
        .filter(blog_posts::id.eq(id))
        .first::<BlogPost>(conn)
}

fn validate_update_blog_post(update: &UpdateBlogPost) -> Vec<BlogValidationError> {
    let mut errors = Vec::new();

    if let Some(title) = &update.title {
        if title.is_empty() {
            errors.push(BlogValidationError::EmptyTitle);
        } else if title.len() > 512 {
            errors.push(BlogValidationError::TitleTooLong);
        }
    }
    if let Some(title_ro) = &update.title_ro {
        if title_ro.is_empty() {
            errors.push(BlogValidationError::EmptyTitleRo);
        } else if title_ro.len() > 512 {
            errors.push(BlogValidationError::TitleRoTooLong);
        }
    }
    if let Some(slug) = &update.slug {
        if slug.is_empty() {
            errors.push(BlogValidationError::EmptySlug);
        } else if slug.len() > 256 {
            errors.push(BlogValidationError::SlugTooLong);
        } else if !crate::utils::is_valid_slug(slug) {
            errors.push(BlogValidationError::InvalidSlug);
        }
    }
    if let Some(content) = &update.content_markdown {
        if content.is_empty() {
            errors.push(BlogValidationError::EmptyContent);
        } else if content.len() > MAX_MARKDOWN_BYTES {
            errors.push(BlogValidationError::ContentTooLarge);
        }
    }
    if let Some(content_ro) = &update.content_markdown_ro {
        if content_ro.is_empty() {
            errors.push(BlogValidationError::EmptyContentRo);
        } else if content_ro.len() > MAX_MARKDOWN_BYTES {
            errors.push(BlogValidationError::ContentRoTooLarge);
        }
    }
    if let Some(excerpt) = &update.excerpt {
        if excerpt.is_empty() {
            errors.push(BlogValidationError::EmptyExcerpt);
        } else if excerpt.len() > 1024 {
            errors.push(BlogValidationError::ExcerptTooLong);
        }
    }
    if let Some(excerpt_ro) = &update.excerpt_ro {
        if excerpt_ro.is_empty() {
            errors.push(BlogValidationError::EmptyExcerptRo);
        } else if excerpt_ro.len() > 1024 {
            errors.push(BlogValidationError::ExcerptRoTooLong);
        }
    }
    if let Some(author) = &update.author {
        if author.is_empty() {
            errors.push(BlogValidationError::EmptyAuthor);
        } else if author.len() > 256 {
            errors.push(BlogValidationError::AuthorTooLong);
        }
    }

    errors
}

pub fn update_blog_post(
    conn: &mut PgConnection,
    id: uuid::Uuid,
    update_post: UpdateBlogPost,
) -> Result<BlogPost, BlogUpdateError> {
    let validation_errors = validate_update_blog_post(&update_post);
    if !validation_errors.is_empty() {
        return Err(BlogUpdateError::ValidationErrors(validation_errors));
    }

    // Pre-check slug uniqueness so we can return a clean 409 before we hit
    // the DB constraint. Skips the check if the slug isn't being changed
    // (i.e., the new slug equals the existing one).
    if let Some(new_slug) = update_post.slug.as_deref() {
        let existing = blog_posts::table
            .filter(blog_posts::slug.eq(new_slug))
            .filter(blog_posts::id.ne(id))
            .select(blog_posts::id)
            .first::<uuid::Uuid>(conn)
            .optional()
            .map_err(BlogUpdateError::from)?;
        if existing.is_some() {
            return Err(BlogUpdateError::DuplicateSlug);
        }
    }

    let post: BlogPost = diesel::update(blog_posts::table.filter(blog_posts::id.eq(id)))
        .set(&update_post)
        .get_result(conn)
        .map_err(BlogUpdateError::from)?;

    // Set published_at on first publish
    if post.is_published && post.published_at.is_none() {
        diesel::update(blog_posts::table.filter(blog_posts::id.eq(id)))
            .set(blog_posts::published_at.eq(Some(chrono::Utc::now().naive_utc())))
            .get_result(conn)
            .map_err(BlogUpdateError::from)
    } else {
        Ok(post)
    }
}

pub fn delete_blog_post(conn: &mut PgConnection, id: uuid::Uuid) -> Result<usize, DieselError> {
    diesel::delete(blog_posts::table.filter(blog_posts::id.eq(id))).execute(conn)
}
