//! Anonymous site statistics reported by the browser: page views and how
//! visitors arrived, product and blog post views, cart additions, shop filter
//! use and the newsletter popup's outcomes. They exist only as in-memory
//! Prometheus counters. There is no cookie, identifier or event log, and
//! every label comes from a closed set or the live catalog, so nothing a
//! client sends reaches the metrics verbatim.
//!
//! Daily visitors are counted with a keyed hash of the client's network and
//! user agent. The key is random, lives only in memory and is replaced at
//! midnight (Bucharest time) together with the day's hashes, so a visitor
//! cannot be recognised across days, nor at all once the day is over.

use std::collections::HashSet;
use std::net::IpAddr;
use std::sync::{LazyLock, Mutex};

use axum::http::HeaderMap;
use chrono::{NaiveDate, Utc};
use chrono_tz::Europe::Bucharest;
use prometheus_client::encoding::EncodeLabelSet;
use prometheus_client::metrics::counter::Counter;
use prometheus_client::metrics::family::Family;
use prometheus_client::registry::Registry;
use serde::{Deserialize, Serialize};
use strum::IntoStaticStr;
use ts_rs::TS;

use crate::enums::{
    AcidityType, BodyType, EffervescenceType, MeadType, SweetnessType, TanninsType, TurbidityType,
};
use crate::language::Language;
use crate::tokens;

/// Visitors counted per day at most, bounding the memory a flood of spoofed
/// clients can take; past it the day's figure stops growing.
const MAX_DAILY_VISITORS: usize = 100_000;

#[derive(Clone, Copy, Debug, Deserialize, IntoStaticStr, TS)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[ts(export)]
pub enum Page {
    Home,
    Shop,
    Product,
    Lot,
    Cart,
    Checkout,
    Blog,
    BlogPost,
    AboutUs,
    Contact,
    CookiePolicy,
    PrivacyPolicy,
    Newsletter,
    Account,
    NotFound,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ShopSort {
    Price,
    Volume,
    BottlingDate,
}

/// A shop filter the visitor picked. The search box is never reported.
#[derive(Clone, Copy, Debug, Deserialize, IntoStaticStr, TS)]
#[serde(tag = "name", content = "value", rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[ts(export)]
pub enum ShopFilter {
    MeadType(MeadType),
    Sweetness(SweetnessType),
    Turbidity(TurbidityType),
    Effervescence(EffervescenceType),
    Acidity(AcidityType),
    Tannins(TanninsType),
    Body(BodyType),
    InStock,
    SortBy(ShopSort),
}

impl ShopFilter {
    fn value(self) -> String {
        let value = match self {
            Self::MeadType(v) => serde_json::to_value(v),
            Self::Sweetness(v) => serde_json::to_value(v),
            Self::Turbidity(v) => serde_json::to_value(v),
            Self::Effervescence(v) => serde_json::to_value(v),
            Self::Acidity(v) => serde_json::to_value(v),
            Self::Tannins(v) => serde_json::to_value(v),
            Self::Body(v) => serde_json::to_value(v),
            Self::SortBy(v) => serde_json::to_value(v),
            Self::InStock => return "true".to_string(),
        };
        value
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .expect("unit enum variants serialize to strings")
    }
}

#[derive(Clone, Copy, Debug, Deserialize, IntoStaticStr, TS)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[ts(export)]
pub enum PopupOutcome {
    Shown,
    Dismissed,
    Subscribed,
}

#[derive(Debug, Deserialize, TS)]
#[serde(tag = "event", rename_all = "snake_case")]
#[ts(export)]
pub enum SiteEvent {
    PageView {
        page: Page,
        /// The page the visitor came from within the site; null for the first
        /// page of a visit.
        from: Option<Page>,
        /// Host name of the referring site, for the first page of a visit only.
        referrer: Option<String>,
    },
    ProductView {
        product_id: String,
    },
    AddToCart {
        product_id: String,
    },
    /// The visitor wanted more bottles than the stock (or order limit) allows.
    CartLimit {
        product_id: String,
    },
    BlogPostView {
        slug: String,
    },
    ShopFilter {
        filter: ShopFilter,
    },
    NewsletterPopup {
        outcome: PopupOutcome,
    },
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct PageViewLabels {
    page: &'static str,
    /// The previous page, or for the first page of a visit where it came
    /// from: `direct`, `search`, `social`, `email` or `other`.
    from: &'static str,
    language: &'static str,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct ProductLabels {
    product_id: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct BlogPostLabels {
    slug: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct FilterLabels {
    filter: &'static str,
    value: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct PopupLabels {
    outcome: &'static str,
}

static PAGE_VIEWS: LazyLock<Family<PageViewLabels, Counter>> = LazyLock::new(Family::default);
static VISITORS: LazyLock<Counter> = LazyLock::new(Counter::default);
static PRODUCT_VIEWS: LazyLock<Family<ProductLabels, Counter>> = LazyLock::new(Family::default);
static CART_ADDS: LazyLock<Family<ProductLabels, Counter>> = LazyLock::new(Family::default);
static CART_LIMITS: LazyLock<Family<ProductLabels, Counter>> = LazyLock::new(Family::default);
static BLOG_POST_VIEWS: LazyLock<Family<BlogPostLabels, Counter>> = LazyLock::new(Family::default);
static FILTER_USES: LazyLock<Family<FilterLabels, Counter>> = LazyLock::new(Family::default);
static POPUP_OUTCOMES: LazyLock<Family<PopupLabels, Counter>> = LazyLock::new(Family::default);

pub fn register(registry: &mut Registry) {
    registry.register(
        "site_page_views",
        "Page views by page, where the visitor came from and language",
        PAGE_VIEWS.clone(),
    );
    registry.register(
        "site_visitors",
        "Visitors, each counted once per day",
        VISITORS.clone(),
    );
    registry.register(
        "shop_product_views",
        "Product page views",
        PRODUCT_VIEWS.clone(),
    );
    registry.register(
        "shop_cart_additions",
        "Times a product was added to a cart",
        CART_ADDS.clone(),
    );
    registry.register(
        "shop_cart_limits",
        "Times a visitor wanted more of a product than stock or the order limit allowed",
        CART_LIMITS.clone(),
    );
    registry.register(
        "blog_post_views",
        "Blog post views",
        BLOG_POST_VIEWS.clone(),
    );
    registry.register(
        "shop_filter_uses",
        "Shop filters picked, by filter and value",
        FILTER_USES.clone(),
    );
    registry.register(
        "newsletter_popup",
        "Newsletter popup outcomes",
        POPUP_OUTCOMES.clone(),
    );
}

/// The event's product or blog post, which must exist before it becomes a
/// label; the caller checks it against the catalog.
pub enum Subject<'a> {
    None,
    Product(&'a str),
    BlogPost(&'a str),
}

impl SiteEvent {
    pub fn subject(&self) -> Subject<'_> {
        match self {
            Self::ProductView { product_id }
            | Self::AddToCart { product_id }
            | Self::CartLimit { product_id } => Subject::Product(product_id),
            Self::BlogPostView { slug } => Subject::BlogPost(slug),
            _ => Subject::None,
        }
    }

    /// Counts the event; `visitor` identifies the client for the daily
    /// visitor count and is used only for a page view.
    pub fn record(self, language: Language, visitor: Visitor<'_>) {
        match self {
            Self::PageView {
                page,
                from,
                referrer,
            } => {
                let from = match from {
                    Some(previous) => previous.into(),
                    None => referrer_kind(referrer.as_deref()),
                };
                PAGE_VIEWS
                    .get_or_create(&PageViewLabels {
                        page: page.into(),
                        from,
                        language: language.code(),
                    })
                    .inc();
                if DAILY_VISITORS
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .is_new(visitor, today())
                {
                    VISITORS.inc();
                }
            }
            Self::ProductView { product_id } => product_counter(&PRODUCT_VIEWS, product_id),
            Self::AddToCart { product_id } => product_counter(&CART_ADDS, product_id),
            Self::CartLimit { product_id } => product_counter(&CART_LIMITS, product_id),
            Self::BlogPostView { slug } => {
                BLOG_POST_VIEWS
                    .get_or_create(&BlogPostLabels { slug })
                    .inc();
            }
            Self::ShopFilter { filter } => {
                FILTER_USES
                    .get_or_create(&FilterLabels {
                        filter: filter.into(),
                        value: filter.value(),
                    })
                    .inc();
            }
            Self::NewsletterPopup { outcome } => {
                POPUP_OUTCOMES
                    .get_or_create(&PopupLabels {
                        outcome: outcome.into(),
                    })
                    .inc();
            }
        }
    }
}

fn product_counter(family: &Family<ProductLabels, Counter>, product_id: String) {
    family.get_or_create(&ProductLabels { product_id }).inc();
}

/// Sites whose links count as search engines, social networks or webmail,
/// matched by domain or its subdomains.
const SEARCH_DOMAINS: &[&str] = &[
    "google.com",
    "google.ro",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "yandex.com",
    "yandex.ru",
    "ecosia.org",
    "search.brave.com",
    "startpage.com",
    "qwant.com",
    "baidu.com",
];
const SOCIAL_DOMAINS: &[&str] = &[
    "facebook.com",
    "fb.com",
    "instagram.com",
    "t.co",
    "x.com",
    "twitter.com",
    "linkedin.com",
    "lnkd.in",
    "pinterest.com",
    "tiktok.com",
    "reddit.com",
    "youtube.com",
    "whatsapp.com",
    "threads.net",
    "bsky.app",
];
const EMAIL_DOMAINS: &[&str] = &[
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
    "mail.yahoo.com",
    "mail.proton.me",
];

fn matches_domain(host: &str, domains: &[&str]) -> bool {
    domains.iter().any(|domain| {
        host == *domain
            || host
                .strip_suffix(domain)
                .is_some_and(|prefix| prefix.ends_with('.'))
    })
}

/// Reduces a referring host to its kind; the host itself is never kept.
/// Webmail is checked first, since it shares domains with search engines.
fn referrer_kind(host: Option<&str>) -> &'static str {
    let Some(host) = host.map(str::to_ascii_lowercase).filter(|h| !h.is_empty()) else {
        return "direct";
    };
    let host = host.as_str();
    if matches_domain(host, EMAIL_DOMAINS) {
        "email"
    } else if matches_domain(host, SEARCH_DOMAINS)
        || host.starts_with("www.google.")
        || host.starts_with("google.")
    {
        "search"
    } else if matches_domain(host, SOCIAL_DOMAINS)
        || host.starts_with("l.facebook.")
        || host.starts_with("lm.facebook.")
    {
        "social"
    } else {
        "other"
    }
}

/// The client as far as the daily visitor count sees it.
#[derive(Clone, Copy)]
pub struct Visitor<'a> {
    pub network: IpAddr,
    pub user_agent: &'a str,
}

struct DailyVisitors {
    day: NaiveDate,
    key: [u8; 32],
    seen: HashSet<[u8; 16]>,
}

static DAILY_VISITORS: LazyLock<Mutex<DailyVisitors>> = LazyLock::new(|| {
    Mutex::new(DailyVisitors {
        day: today(),
        key: tokens::random_key(),
        seen: HashSet::new(),
    })
});

fn today() -> NaiveDate {
    Utc::now().with_timezone(&Bucharest).date_naive()
}

impl DailyVisitors {
    fn is_new(&mut self, visitor: Visitor<'_>, day: NaiveDate) -> bool {
        if day != self.day {
            self.day = day;
            self.key = tokens::random_key();
            self.seen = HashSet::new();
        }
        if self.seen.len() >= MAX_DAILY_VISITORS {
            return false;
        }
        let mut data = visitor.network.to_string().into_bytes();
        data.push(0);
        data.extend_from_slice(visitor.user_agent.as_bytes());
        let digest = hmac::Mac::finalize(tokens::mac(&self.key, &data)).into_bytes();
        let mut id = [0u8; 16];
        id.copy_from_slice(&digest[..16]);
        self.seen.insert(id)
    }
}

/// The visitor asked not to be tracked (Do Not Track or Global Privacy
/// Control).
pub fn opted_out(headers: &HeaderMap) -> bool {
    ["dnt", "sec-gpc"]
        .iter()
        .any(|name| headers.get(*name).is_some_and(|v| v == "1"))
}

/// Crawlers and headless browsers that run the site's scripts.
pub fn is_bot(user_agent: &str) -> bool {
    let user_agent = user_agent.to_ascii_lowercase();
    user_agent.is_empty()
        || [
            "bot",
            "crawl",
            "spider",
            "slurp",
            "headless",
            "lighthouse",
            "preview",
        ]
        .iter()
        .any(|marker| user_agent.contains(marker))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn visitor(ip: &str, user_agent: &'static str) -> Visitor<'static> {
        Visitor {
            network: ip.parse().unwrap(),
            user_agent,
        }
    }

    #[test]
    fn visitors_are_counted_once_a_day() {
        let day = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let mut visitors = DailyVisitors {
            day,
            key: tokens::random_key(),
            seen: HashSet::new(),
        };
        let first = visitor("203.0.113.7", "Firefox");
        assert!(visitors.is_new(first, day));
        assert!(!visitors.is_new(first, day));
        assert!(visitors.is_new(visitor("203.0.113.7", "Chrome"), day));
        assert!(visitors.is_new(visitor("203.0.113.8", "Firefox"), day));

        let key = visitors.key;
        assert!(visitors.is_new(first, day.succ_opt().unwrap()));
        assert_ne!(visitors.key, key);
        assert_eq!(visitors.seen.len(), 1);
    }

    #[test]
    fn referrers_are_reduced_to_their_kind() {
        assert_eq!(referrer_kind(None), "direct");
        assert_eq!(referrer_kind(Some("")), "direct");
        assert_eq!(referrer_kind(Some("www.google.ro")), "search");
        assert_eq!(referrer_kind(Some("www.google.co.uk")), "search");
        assert_eq!(referrer_kind(Some("duckduckgo.com")), "search");
        assert_eq!(referrer_kind(Some("mail.google.com")), "email");
        assert_eq!(referrer_kind(Some("l.facebook.com")), "social");
        assert_eq!(referrer_kind(Some("m.facebook.com")), "social");
        assert_eq!(referrer_kind(Some("T.CO")), "social");
        assert_eq!(referrer_kind(Some("notfacebook.com")), "other");
        assert_eq!(referrer_kind(Some("example.ro")), "other");
    }

    #[test]
    fn shop_filters_have_bounded_labels() {
        let filter: ShopFilter =
            serde_json::from_str(r#"{"name":"sweetness","value":"semi-dry"}"#).unwrap();
        assert_eq!(<&str>::from(filter), "sweetness");
        assert_eq!(filter.value(), "semi-dry");
        let filter: ShopFilter =
            serde_json::from_str(r#"{"name":"sort_by","value":"bottling_date"}"#).unwrap();
        assert_eq!(filter.value(), "bottling_date");
        assert!(serde_json::from_str::<ShopFilter>(r#"{"name":"sweetness","value":"x"}"#).is_err());
        assert!(serde_json::from_str::<ShopFilter>(r#"{"name":"search","value":"x"}"#).is_err());
    }

    #[test]
    fn opt_out_and_bots() {
        let mut headers = HeaderMap::new();
        assert!(!opted_out(&headers));
        headers.insert("sec-gpc", "1".parse().unwrap());
        assert!(opted_out(&headers));
        assert!(is_bot(""));
        assert!(is_bot("Mozilla/5.0 (compatible; Googlebot/2.1)"));
        assert!(is_bot("Mozilla/5.0 HeadlessChrome/120"));
        assert!(!is_bot("Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0"));
    }
}
