use crate::models::{BlogPost, Product};
use crate::schema::*;
use chrono::Utc;
use diesel::prelude::*;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SitemapUrl {
    pub loc: String,
    pub lastmod: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SitemapData {
    pub static_urls: Vec<SitemapUrl>,
    pub product_urls: Vec<SitemapUrl>,
    pub blog_urls: Vec<SitemapUrl>,
}

pub fn get_sitemap_data(
    conn: &mut PgConnection,
    site_url: &str,
) -> Result<SitemapData, diesel::result::Error> {
    let products = products::table
        .filter(products::deleted_at.is_null())
        .select(Product::as_select())
        .load::<Product>(conn)?;

    let blog_posts = blog_posts::table
        .filter(blog_posts::is_published.eq(true))
        .select(BlogPost::as_select())
        .load::<BlogPost>(conn)?;

    let today = Utc::now().format("%Y-%m-%d").to_string();

    let static_urls = vec![
        SitemapUrl {
            loc: site_url.to_string(),
            lastmod: today.clone(),
            images: vec![],
        },
        SitemapUrl {
            loc: format!("{}/shop", site_url),
            lastmod: today.clone(),
            images: vec![],
        },
        SitemapUrl {
            loc: format!("{}/blog", site_url),
            lastmod: today.clone(),
            images: vec![],
        },
        SitemapUrl {
            loc: format!("{}/about-us", site_url),
            lastmod: today.clone(),
            images: vec![],
        },
        SitemapUrl {
            loc: format!("{}/contact", site_url),
            lastmod: today,
            images: vec![],
        },
    ];

    let product_urls = products
        .iter()
        .map(|product| SitemapUrl {
            loc: format!("{}/shop/{}", site_url, product.product_id),
            lastmod: product.updated_at.format("%Y-%m-%d").to_string(),
            images: product
                .image_id
                .map(|id| vec![format!("{}/images/{}", site_url, id)])
                .unwrap_or_default(),
        })
        .collect();

    let blog_urls = blog_posts
        .iter()
        .map(|blog_post| SitemapUrl {
            loc: format!("{}/blog/{}", site_url, blog_post.slug),
            lastmod: blog_post.updated_at.format("%Y-%m-%d").to_string(),
            images: vec![],
        })
        .collect();

    Ok(SitemapData {
        static_urls,
        product_urls,
        blog_urls,
    })
}
