use crate::enums::*;
use crate::language::Language;
use crate::models::{BlogPost, Image, Product};
use crate::product_crud::ProductWithImage;
use rust_decimal::Decimal;
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct LocalizedProduct {
    pub product_id: String,
    pub product_name: String,
    pub product_description: String,
    pub ingredients: String,
    pub product_type: MeadType,
    pub sweetness: SweetnessType,
    pub turbidity: TurbidityType,
    pub effervescence: EffervescenceType,
    pub acidity: AcidityType,
    pub tannins: TanninsType,
    pub body: BodyType,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub price: Decimal,
    pub currency: String,
    pub image_id: Option<uuid::Uuid>,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct LocalizedProductWithImage {
    pub product: LocalizedProduct,
    pub image: Option<Image>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct LocalizedBlogPost {
    pub id: uuid::Uuid,
    pub title: String,
    pub slug: String,
    pub content_markdown: String,
    pub excerpt: String,
    pub author: String,
    pub published_at: Option<chrono::NaiveDateTime>,
    pub updated_at: chrono::NaiveDateTime,
    pub is_published: bool,
}

/// Pick the language-specific value for a field that has both an English and
/// a Romanian variant. Caller passes EN first, RO second.
fn pick<T>(lang: Language, en: T, ro: T) -> T {
    match lang {
        Language::En => en,
        Language::Ro => ro,
    }
}

impl LocalizedProduct {
    pub fn from_product(product: Product, lang: Language) -> Self {
        LocalizedProduct {
            product_id: product.product_id,
            product_name: pick(lang, product.product_name, product.product_name_ro),
            product_description: pick(
                lang,
                product.product_description,
                product.product_description_ro,
            ),
            ingredients: pick(lang, product.ingredients, product.ingredients_ro),
            product_type: product.product_type,
            sweetness: product.sweetness,
            turbidity: product.turbidity,
            effervescence: product.effervescence,
            acidity: product.acidity,
            tannins: product.tannins,
            body: product.body,
            abv: product.abv,
            bottle_count: product.bottle_count,
            bottle_size: product.bottle_size,
            price: pick(lang, product.price, product.price_ron),
            currency: pick(lang, "EUR", "RON").to_string(),
            image_id: product.image_id,
            bottling_date: product.bottling_date,
            lot_number: product.lot_number,
        }
    }
}

impl LocalizedProductWithImage {
    pub fn from_product_with_image(pwi: ProductWithImage, lang: Language) -> Self {
        LocalizedProductWithImage {
            product: LocalizedProduct::from_product(pwi.product, lang),
            image: pwi.image,
        }
    }
}

impl LocalizedBlogPost {
    pub fn from_blog_post(post: BlogPost, lang: Language) -> Self {
        LocalizedBlogPost {
            id: post.id,
            title: pick(lang, post.title, post.title_ro),
            slug: post.slug,
            content_markdown: pick(lang, post.content_markdown, post.content_markdown_ro),
            excerpt: pick(lang, post.excerpt, post.excerpt_ro),
            author: post.author,
            published_at: post.published_at,
            updated_at: post.updated_at,
            is_published: post.is_published,
        }
    }
}
