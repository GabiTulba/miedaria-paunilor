use crate::models::{BlogPost, Product};
use crate::schema::*;
use chrono::{NaiveDateTime, Utc};
use diesel::prelude::*;
use serde::Serialize;

const LANGS: [&str; 2] = ["ro", "en"];
const X_DEFAULT_LANG: &str = "ro";

#[derive(Debug, Clone, Serialize)]
pub struct SitemapAlternate {
    pub hreflang: String,
    pub href: String,
}

#[derive(Debug, Serialize)]
pub struct SitemapUrl {
    pub loc: String,
    pub lastmod: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub alternates: Vec<SitemapAlternate>,
}

#[derive(Debug, Serialize)]
pub struct SitemapData {
    pub static_urls: Vec<SitemapUrl>,
    pub product_urls: Vec<SitemapUrl>,
    pub blog_urls: Vec<SitemapUrl>,
}

fn iso_lastmod_now() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S%:z").to_string()
}

fn iso_lastmod(ts: NaiveDateTime) -> String {
    ts.and_utc().format("%Y-%m-%dT%H:%M:%S%:z").to_string()
}

/// Build the absolute URL for a given language and path suffix.
/// `path_suffix` should start with "/" or be empty (homepage).
fn lang_url(site_url: &str, lang: &str, path_suffix: &str) -> String {
    format!("{}/{}{}", site_url, lang, path_suffix)
}

/// Build alternates list for a given path suffix: one entry per supported
/// language plus an x-default pointing at the Romanian variant.
fn build_alternates(site_url: &str, path_suffix: &str) -> Vec<SitemapAlternate> {
    let mut alternates: Vec<SitemapAlternate> = LANGS
        .iter()
        .map(|lang| SitemapAlternate {
            hreflang: lang.to_string(),
            href: lang_url(site_url, lang, path_suffix),
        })
        .collect();
    alternates.push(SitemapAlternate {
        hreflang: "x-default".to_string(),
        href: lang_url(site_url, X_DEFAULT_LANG, path_suffix),
    });
    alternates
}

/// Emit one SitemapUrl per supported language for a given path, each carrying
/// the full set of alternates (so crawlers can discover the language pairing
/// from any entry).
fn lang_pair(
    site_url: &str,
    path_suffix: &str,
    lastmod: String,
    images: Vec<String>,
) -> Vec<SitemapUrl> {
    let alternates = build_alternates(site_url, path_suffix);
    LANGS
        .iter()
        .map(|lang| SitemapUrl {
            loc: lang_url(site_url, lang, path_suffix),
            lastmod: lastmod.clone(),
            images: images.clone(),
            alternates: alternates.clone(),
        })
        .collect()
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

    let now = iso_lastmod_now();

    let static_paths = ["", "/shop", "/blog", "/about-us", "/contact"];
    let static_urls: Vec<SitemapUrl> = static_paths
        .iter()
        .flat_map(|p| lang_pair(site_url, p, now.clone(), vec![]))
        .collect();

    let product_urls: Vec<SitemapUrl> = products
        .iter()
        .flat_map(|product| {
            let path = format!("/shop/{}", product.product_id);
            let images = product
                .image_id
                .map(|id| vec![format!("{}/images/{}", site_url, id)])
                .unwrap_or_default();
            lang_pair(site_url, &path, iso_lastmod(product.updated_at), images)
        })
        .collect();

    let blog_urls: Vec<SitemapUrl> = blog_posts
        .iter()
        .flat_map(|blog_post| {
            let path = format!("/blog/{}", blog_post.slug);
            lang_pair(site_url, &path, iso_lastmod(blog_post.updated_at), vec![])
        })
        .collect();

    Ok(SitemapData {
        static_urls,
        product_urls,
        blog_urls,
    })
}
