use crate::enums::*;
use crate::exchange_rate::EurRate;
use crate::language::Language;
use crate::lot_crud::LotPageRow;
use crate::models::{BlogPost, Image, LotNutrition, Product};
use crate::product_crud::ProductWithImage;
use rust_decimal::{Decimal, RoundingStrategy};
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
    /// True when `price` is an indicative EUR amount derived from the RON
    /// price via the official BNR rate (English site). The frontend renders a
    /// footnote explaining the conversion.
    pub is_converted: bool,
    /// Date of the BNR rate used for conversion; None when `is_converted` is
    /// false.
    pub rate_date: Option<chrono::NaiveDate>,
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
    pub fn from_product(product: Product, lang: Language, eur_rate: Option<EurRate>) -> Self {
        // RON is the source of truth; the English site shows an indicative
        // EUR amount derived from the official BNR rate. When no rate is
        // known yet, fall back to RON rather than inventing a price.
        let (price, currency, is_converted, rate_date) = match (lang, eur_rate) {
            (Language::En, Some(r)) => (
                (product.price_ron / r.rate)
                    .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero),
                "EUR".to_string(),
                true,
                Some(r.rate_date),
            ),
            _ => (product.price_ron, "RON".to_string(), false, None),
        };
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
            price,
            currency,
            is_converted,
            rate_date,
            image_id: product.image_id,
            bottling_date: product.bottling_date,
            lot_number: product.lot_number,
        }
    }
}

/// Public QR lot page payload: the frozen batch snapshot plus the localized
/// live product data. `product_available` is false for soft-deleted (retired)
/// products so the page can hide shop links while still rendering label data.
#[derive(Serialize, Debug, TS)]
#[ts(export)]
pub struct LocalizedLot {
    pub lot_number: i32,
    pub bottling_date: chrono::NaiveDate,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub abv: Decimal,
    pub nutrition: LotNutrition,
    pub product: LocalizedProduct,
    pub image: Option<Image>,
    pub product_available: bool,
}

impl LocalizedLot {
    pub fn from_lot_page(row: LotPageRow, lang: Language, eur_rate: Option<EurRate>) -> Self {
        let product_available = row.product.deleted_at.is_none();
        LocalizedLot {
            lot_number: row.lot.lot_number,
            bottling_date: row.lot.bottling_date,
            abv: row.lot.abv,
            nutrition: row.lot.nutrition,
            product: LocalizedProduct::from_product(row.product, lang, eur_rate),
            image: row.image,
            product_available,
        }
    }
}

impl LocalizedProductWithImage {
    pub fn from_product_with_image(
        pwi: ProductWithImage,
        lang: Language,
        eur_rate: Option<EurRate>,
    ) -> Self {
        LocalizedProductWithImage {
            product: LocalizedProduct::from_product(pwi.product, lang, eur_rate),
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
