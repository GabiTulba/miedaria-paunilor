use crate::enums::*;
use crate::language::Language;
use crate::models::{BlogPost, Image, Product};
use crate::product_crud::ProductWithImage;
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Serialize)]
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
    pub abv: Decimal,
    pub bottle_count: i32,
    pub bottle_size: i32,
    #[serde(with = "rust_decimal::serde::float")]
    pub price: Decimal,
    pub currency: String,
    pub image_id: uuid::Uuid,
    pub bottling_date: chrono::NaiveDate,
    pub lot_number: i32,
}

#[derive(Debug, Serialize)]
pub struct LocalizedProductWithImage {
    pub product: LocalizedProduct,
    pub image: Option<Image>,
}

#[derive(Debug, Serialize)]
pub struct LocalizedBlogPost {
    pub id: uuid::Uuid,
    pub title: String,
    pub blog_id: String,
    pub content_markdown: String,
    pub excerpt: String,
    pub author: String,
    pub published_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
    pub is_published: bool,
}

impl LocalizedProduct {
    pub fn from_product(product: Product, lang: Language) -> Self {
        let (name, desc, ingr, price, currency) = match lang {
            Language::Ro => (
                product.product_name_ro,
                product.product_description_ro,
                product.ingredients_ro,
                product.price_ron,
                "RON".to_string(),
            ),
            Language::En => (
                product.product_name,
                product.product_description,
                product.ingredients,
                product.price,
                "EUR".to_string(),
            ),
        };
        LocalizedProduct {
            product_id: product.product_id,
            product_name: name,
            product_description: desc,
            ingredients: ingr,
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
            price,
            currency,
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
        let (title, content, excerpt) = match lang {
            Language::Ro => (
                post.title_ro,
                post.content_markdown_ro,
                post.excerpt_ro,
            ),
            Language::En => (
                post.title,
                post.content_markdown,
                post.excerpt,
            ),
        };
        LocalizedBlogPost {
            id: post.id,
            title,
            blog_id: post.blog_id,
            content_markdown: content,
            excerpt,
            author: post.author,
            published_at: post.published_at,
            updated_at: post.updated_at,
            is_published: post.is_published,
        }
    }
}
