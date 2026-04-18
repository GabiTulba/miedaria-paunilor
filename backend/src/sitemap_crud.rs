use crate::models::{BlogPost, Product};
use crate::schema::*;
use chrono::Utc;
use diesel::prelude::*;
use serde::Serialize;

const PRIORITY_HOME: f32 = 1.0;
const PRIORITY_SHOP: f32 = 0.9;
const PRIORITY_BLOG_INDEX: f32 = 0.8;
const PRIORITY_PRODUCT: f32 = 0.8;
const PRIORITY_SECONDARY: f32 = 0.7; // about-us, contact, blog posts
const PRIORITY_CART: f32 = 0.5;

const CHANGEFREQ_DAILY: &str = "daily";
const CHANGEFREQ_WEEKLY: &str = "weekly";
const CHANGEFREQ_MONTHLY: &str = "monthly";

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

pub fn get_sitemap_data(
    conn: &mut PgConnection,
    site_url: &str,
) -> Result<SitemapData, diesel::result::Error> {
    let products = products::table
        .select(Product::as_select())
        .load::<Product>(conn)?;

    let blog_posts = blog_posts::table
        .filter(blog_posts::is_published.eq(true))
        .select(BlogPost::as_select())
        .load::<BlogPost>(conn)?;

    let today = Utc::now().format("%Y-%m-%d").to_string();

    let static_urls = vec![
        SitemapUrl {
            loc: format!("{}/home", site_url),
            lastmod: today.clone(),
            changefreq: CHANGEFREQ_WEEKLY.to_string(),
            priority: PRIORITY_HOME,
        },
        SitemapUrl {
            loc: format!("{}/shop", site_url),
            lastmod: today.clone(),
            changefreq: CHANGEFREQ_DAILY.to_string(),
            priority: PRIORITY_SHOP,
        },
        SitemapUrl {
            loc: format!("{}/blog", site_url),
            lastmod: today.clone(),
            changefreq: CHANGEFREQ_WEEKLY.to_string(),
            priority: PRIORITY_BLOG_INDEX,
        },
        SitemapUrl {
            loc: format!("{}/about-us", site_url),
            lastmod: today.clone(),
            changefreq: CHANGEFREQ_MONTHLY.to_string(),
            priority: PRIORITY_SECONDARY,
        },
        SitemapUrl {
            loc: format!("{}/contact", site_url),
            lastmod: today.clone(),
            changefreq: CHANGEFREQ_MONTHLY.to_string(),
            priority: PRIORITY_SECONDARY,
        },
        SitemapUrl {
            loc: format!("{}/cart", site_url),
            lastmod: today,
            changefreq: CHANGEFREQ_MONTHLY.to_string(),
            priority: PRIORITY_CART,
        },
    ];

    let product_urls = products
        .iter()
        .map(|product| SitemapUrl {
            loc: format!("{}/shop/{}", site_url, product.product_id),
            lastmod: product.bottling_date.format("%Y-%m-%d").to_string(),
            changefreq: CHANGEFREQ_MONTHLY.to_string(),
            priority: PRIORITY_PRODUCT,
        })
        .collect();

    let blog_urls = blog_posts
        .iter()
        .map(|blog_post| SitemapUrl {
            loc: format!("{}/blog/{}", site_url, blog_post.blog_id),
            lastmod: blog_post.updated_at.format("%Y-%m-%d").to_string(),
            changefreq: CHANGEFREQ_MONTHLY.to_string(),
            priority: PRIORITY_SECONDARY,
        })
        .collect();

    Ok(SitemapData {
        static_urls,
        product_urls,
        blog_urls,
    })
}
