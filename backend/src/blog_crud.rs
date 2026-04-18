use crate::models::{BlogPost, NewBlogPost, UpdateBlogPost};
use crate::schema::*;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum BlogValidationError {
    EmptyTitle,
    TitleTooLong,
    EmptyTitleRo,
    TitleRoTooLong,
    EmptyBlogId,
    BlogIdTooLong,
    InvalidBlogId,
    EmptyContent,
    EmptyContentRo,
    EmptyExcerpt,
    ExcerptTooLong,
    EmptyExcerptRo,
    ExcerptRoTooLong,
    EmptyAuthor,
    AuthorTooLong,
}

#[derive(Debug)]
pub enum BlogCreationError {
    DuplicateBlogId,
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
                        if constraint_name.contains("blog_id") {
                            return BlogCreationError::DuplicateBlogId;
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
    DatabaseError(String),
    ValidationErrors(Vec<BlogValidationError>),
    UnknownError,
}

impl From<DieselError> for BlogUpdateError {
    fn from(error: DieselError) -> Self {
        match error {
            DieselError::NotFound => BlogUpdateError::NotFound,
            DieselError::DatabaseError(kind, info) => {
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

    if new_post.blog_id.is_empty() {
        errors.push(BlogValidationError::EmptyBlogId);
    } else if new_post.blog_id.len() > 256 {
        errors.push(BlogValidationError::BlogIdTooLong);
    } else {
        let blog_id_is_valid = new_post
            .blog_id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c == '-' || c.is_ascii_digit());
        if !blog_id_is_valid {
            errors.push(BlogValidationError::InvalidBlogId);
        }
    }

    if new_post.content_markdown.is_empty() {
        errors.push(BlogValidationError::EmptyContent);
    }

    if new_post.content_markdown_ro.is_empty() {
        errors.push(BlogValidationError::EmptyContentRo);
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
    new_post: NewBlogPost,
) -> Result<BlogPost, BlogCreationError> {
    let validation_errors = validate_blog_post(&new_post);
    if !validation_errors.is_empty() {
        return Err(BlogCreationError::ValidationErrors(validation_errors));
    }

    diesel::insert_into(blog_posts::table)
        .values(&new_post)
        .get_result(conn)
        .map_err(BlogCreationError::from)
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

pub fn get_blog_post_by_blog_id(
    conn: &mut PgConnection,
    blog_id: &str,
) -> Result<BlogPost, DieselError> {
    blog_posts::table
        .filter(blog_posts::blog_id.eq(blog_id))
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

pub fn update_blog_post(
    conn: &mut PgConnection,
    id: uuid::Uuid,
    update_post: UpdateBlogPost,
) -> Result<BlogPost, BlogUpdateError> {
    diesel::update(blog_posts::table.filter(blog_posts::id.eq(id)))
        .set(&update_post)
        .get_result(conn)
        .map_err(BlogUpdateError::from)
}

pub fn delete_blog_post(conn: &mut PgConnection, id: uuid::Uuid) -> Result<usize, DieselError> {
    diesel::delete(blog_posts::table.filter(blog_posts::id.eq(id))).execute(conn)
}
