use crate::models::{BlogPost, Product};
use crate::schema::*;
use chrono::Utc;
use diesel::prelude::*;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SitemapUrl {
    pub loc: String,
    pub lastmod: String,
    pub changefreq: String,
    pub priority: f32,
}

#[derive(Debug, Serialize)]
pub struct SitemapData {
    pub static_urls: Vec<SitemapUrl>,
    pub product_urls: Vec<SitemapUrl>,
    pub blog_urls: Vec<SitemapUrl>,
}

pub fn get_sitemap_data(conn: &mut PgConnection) -> Result<SitemapData, diesel::result::Error> {
    // Get all products
    let products = products::table
        .select(Product::as_select())
        .load::<Product>(conn)?;

    // Get all published blog posts
    let blog_posts = blog_posts::table
        .filter(blog_posts::is_published.eq(true))
        .select(BlogPost::as_select())
        .load::<BlogPost>(conn)?;

    // Static URLs
    let static_urls = vec![
        SitemapUrl {
            loc: "https://miedaria-paunilor.ro/home".to_string(),
            lastmod: Utc::now().format("%Y-%m-%d").to_string(),
            changefreq: "weekly".to_string(),
            priority: 1.0,
        },
        SitemapUrl {
            loc: "https://miedaria-paunilor.ro/shop".to_string(),
            lastmod: Utc::now().format("%Y-%m-%d").to_string(),
            changefreq: "daily".to_string(),
            priority: 0.9,
        },
        SitemapUrl {
            loc: "https://miedaria-paunilor.ro/blog".to_string(),
            lastmod: Utc::now().format("%Y-%m-%d").to_string(),
            changefreq: "weekly".to_string(),
            priority: 0.8,
        },
        SitemapUrl {
            loc: "https://miedaria-paunilor.ro/about-us".to_string(),
            lastmod: Utc::now().format("%Y-%m-%d").to_string(),
            changefreq: "monthly".to_string(),
            priority: 0.7,
        },
        SitemapUrl {
            loc: "https://miedaria-paunilor.ro/contact".to_string(),
            lastmod: Utc::now().format("%Y-%m-%d").to_string(),
            changefreq: "monthly".to_string(),
            priority: 0.7,
        },
        SitemapUrl {
            loc: "https://miedaria-paunilor.ro/cart".to_string(),
            lastmod: Utc::now().format("%Y-%m-%d").to_string(),
            changefreq: "monthly".to_string(),
            priority: 0.5,
        },
    ];

    // Product URLs
    let product_urls = products
        .iter()
        .map(|product| SitemapUrl {
            loc: format!("https://miedaria-paunilor.ro/shop/{}", product.product_id),
            lastmod: product.bottling_date.format("%Y-%m-%d").to_string(),
            changefreq: "monthly".to_string(),
            priority: 0.8,
        })
        .collect();

    // Blog post URLs
    let blog_urls = blog_posts
        .iter()
        .map(|blog_post| SitemapUrl {
            loc: format!("https://miedaria-paunilor.ro/blog/{}", blog_post.blog_id),
            lastmod: blog_post.updated_at.format("%Y-%m-%d").to_string(),
            changefreq: "monthly".to_string(),
            priority: 0.7,
        })
        .collect();

    Ok(SitemapData {
        static_urls,
        product_urls,
        blog_urls,
    })
}