//! Prometheus metrics, served on a separate internal port for the Prometheus
//! container to scrape. Request and background-task counters live in process
//! memory; shop figures (orders, revenue, stock, subscribers) are read from
//! the database on every scrape, so they survive restarts and never drift
//! from the source of truth. No metric identifies a visitor.

use std::sync::{Arc, LazyLock};
use std::time::Instant;

use axum::{
    Router,
    extract::{MatchedPath, Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
};
use diesel::dsl::count_star;
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Varchar};
use prometheus_client::collector::Collector;
use prometheus_client::encoding::{
    DescriptorEncoder, EncodeLabelSet, EncodeLabelValue, EncodeMetric, text,
};
use prometheus_client::metrics::counter::{ConstCounter, Counter};
use prometheus_client::metrics::family::Family;
use prometheus_client::metrics::gauge::ConstGauge;
use prometheus_client::metrics::histogram::{Histogram, exponential_buckets};
use prometheus_client::registry::Registry;

use crate::AppState;
use crate::analytics;
use crate::customer_crud;
use crate::db;
use crate::enums::OrderStatus;
use crate::newsletter::{self, NewsletterStats};
use crate::order_crud;
use crate::schema::{orders, shipments};
use crate::settings_crud;

/// Orders are charged in RON; its series exist from the first scrape so that
/// `increase()` also counts the very first sale.
const DEFAULT_CURRENCY: &str = "RON";
const ORDER_STATUSES: [OrderStatus; 5] = [
    OrderStatus::Pending,
    OrderStatus::Processing,
    OrderStatus::Paid,
    OrderStatus::Expired,
    OrderStatus::Failed,
];

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct HttpLabels {
    method: String,
    /// The route template (`/api/products/{product_id}`), never the raw path,
    /// so ids and tokens cannot reach the metrics.
    route: String,
    status: u16,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct RouteLabels {
    method: String,
    route: String,
}

#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq, EncodeLabelValue)]
#[allow(non_camel_case_types)]
pub enum Task {
    bnr_refresh,
    email_delivery,
    newsletter_purge,
    reservation_sweep,
    processing_reconcile,
    shop_metrics,
    account_purge,
    order_retention,
    sameday_lockers,
    sameday_tracking,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct TaskLabels {
    task: Task,
}

static HTTP_REQUESTS: LazyLock<Family<HttpLabels, Counter>> = LazyLock::new(Family::default);
static HTTP_DURATION: LazyLock<Family<RouteLabels, Histogram>> = LazyLock::new(|| {
    Family::new_with_constructor(|| Histogram::new(exponential_buckets(0.005, 2.0, 12)))
});
static TASK_FAILURES: LazyLock<Family<TaskLabels, Counter>> = LazyLock::new(Family::default);

#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq, EncodeLabelValue)]
#[allow(non_camel_case_types)]
pub enum LoginResult {
    success,
    failure,
    throttled,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct LoginLabels {
    result: LoginResult,
}

static ACCOUNT_LOGINS: LazyLock<Family<LoginLabels, Counter>> = LazyLock::new(Family::default);

/// Counts a failed run of a background task, next to its error log line.
pub fn record_failure(task: Task) {
    TASK_FAILURES.get_or_create(&TaskLabels { task }).inc();
}

/// Counts a customer password check (login or re-authentication). A surge of
/// failures signals credential stuffing.
pub fn record_login(result: LoginResult) {
    ACCOUNT_LOGINS.get_or_create(&LoginLabels { result }).inc();
}

/// Middleware counting and timing every routed request. Mounted as a route
/// layer, so unmatched paths (scanners) are not recorded.
pub async fn track_http(request: Request, next: Next) -> Response {
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map_or_else(|| "unmatched".to_string(), |p| p.as_str().to_string());
    let method = request.method().to_string();
    let start = Instant::now();
    let response = next.run(request).await;

    HTTP_DURATION
        .get_or_create(&RouteLabels {
            method: method.clone(),
            route: route.clone(),
        })
        .observe(start.elapsed().as_secs_f64());
    HTTP_REQUESTS
        .get_or_create(&HttpLabels {
            method,
            route,
            status: response.status().as_u16(),
        })
        .inc();
    response
}

#[derive(Debug, QueryableByName)]
struct CurrencyTotals {
    #[diesel(sql_type = Varchar)]
    currency: String,
    #[diesel(sql_type = BigInt)]
    checkouts: i64,
    #[diesel(sql_type = BigInt)]
    paid_orders: i64,
    #[diesel(sql_type = BigInt)]
    paid_cents: i64,
}

#[derive(Debug, QueryableByName)]
struct ProductSales {
    #[diesel(sql_type = Varchar)]
    product_id: String,
    #[diesel(sql_type = Varchar)]
    currency: String,
    #[diesel(sql_type = BigInt)]
    bottles: i64,
    #[diesel(sql_type = BigInt)]
    revenue_cents: i64,
}

/// Paid orders and shipping charged per delivery method (always RON).
#[derive(Debug, QueryableByName)]
struct DeliveryTotals {
    #[diesel(sql_type = Varchar)]
    method: String,
    #[diesel(sql_type = BigInt)]
    paid_orders: i64,
    #[diesel(sql_type = BigInt)]
    shipping_cents: i64,
}

#[derive(Debug, QueryableByName)]
struct ProductStock {
    #[diesel(sql_type = Varchar)]
    product_id: String,
    #[diesel(sql_type = BigInt)]
    available: i64,
    #[diesel(sql_type = BigInt)]
    reserved: i64,
}

/// Shop figures read from the database for one scrape.
#[derive(Debug)]
struct ShopSnapshot {
    orders_by_status: Vec<(OrderStatus, i64)>,
    currencies: Vec<CurrencyTotals>,
    product_sales: Vec<ProductSales>,
    stock: Vec<ProductStock>,
    deliveries: Vec<DeliveryTotals>,
    shipments_in_transit: i64,
    stale_processing: i64,
    subscribers: NewsletterStats,
    customers: i64,
    checkout_enabled: bool,
}

impl ShopSnapshot {
    fn load(conn: &mut PgConnection) -> QueryResult<Self> {
        let counted: Vec<(OrderStatus, i64)> = orders::table
            .group_by(orders::status)
            .select((orders::status, count_star()))
            .load(conn)?;
        let orders_by_status = ORDER_STATUSES
            .into_iter()
            .map(|status| {
                let count = counted
                    .iter()
                    .find(|(s, _)| *s == status)
                    .map_or(0, |(_, c)| *c);
                (status, count)
            })
            .collect();

        let currencies = diesel::sql_query(
            "SELECT c.currency, COUNT(o.order_id) AS checkouts, \
             COUNT(o.order_id) FILTER (WHERE o.status = 'paid') AS paid_orders, \
             COALESCE(SUM(o.total_amount_cents) FILTER (WHERE o.status = 'paid'), 0)::bigint AS paid_cents \
             FROM (SELECT $1::varchar AS currency UNION SELECT currency FROM orders) c \
             LEFT JOIN orders o ON o.currency = c.currency \
             GROUP BY c.currency",
        )
        .bind::<Varchar, _>(DEFAULT_CURRENCY)
        .load(conn)?;

        // Every live product has a RON series (zero until its first sale), and
        // every product that ever sold has one per currency, even if deleted.
        let product_sales = diesel::sql_query(
            "WITH sold AS ( \
                 SELECT i.product_id, o.currency, SUM(i.quantity)::bigint AS bottles, \
                 SUM(i.quantity::bigint * i.unit_amount_cents)::bigint AS revenue_cents \
                 FROM order_items i JOIN orders o ON o.order_id = i.order_id \
                 WHERE o.status = 'paid' GROUP BY i.product_id, o.currency \
             ), series AS ( \
                 SELECT product_id, $1::varchar AS currency FROM products WHERE deleted_at IS NULL \
                 UNION SELECT product_id, currency FROM sold \
             ) \
             SELECT s.product_id, s.currency, \
             COALESCE(sold.bottles, 0) AS bottles, COALESCE(sold.revenue_cents, 0) AS revenue_cents \
             FROM series s LEFT JOIN sold USING (product_id, currency)",
        )
        .bind::<Varchar, _>(DEFAULT_CURRENCY)
        .load(conn)?;

        let stock = diesel::sql_query(
            "SELECT p.product_id, p.bottle_count::bigint AS available, \
             COALESCE(SUM(i.quantity), 0)::bigint AS reserved \
             FROM products p \
             LEFT JOIN (order_items i JOIN orders o ON o.order_id = i.order_id \
                 AND o.status IN ('pending', 'processing')) ON i.product_id = p.product_id \
             WHERE p.deleted_at IS NULL \
             GROUP BY p.product_id",
        )
        .load(conn)?;

        // Both methods always have a series so `increase()` counts first orders.
        let deliveries = diesel::sql_query(
            "SELECT m.method::varchar AS method, \
             COUNT(o.order_id) AS paid_orders, \
             COALESCE(SUM(o.shipping_amount_cents), 0)::bigint AS shipping_cents \
             FROM unnest(enum_range(NULL::delivery_method_enum)) AS m(method) \
             LEFT JOIN orders o ON o.delivery_method = m.method AND o.status = 'paid' \
             GROUP BY m.method",
        )
        .load(conn)?;
        let shipments_in_transit = shipments::table
            .filter(shipments::delivered_at.is_null())
            .filter(shipments::canceled.eq(false))
            .count()
            .get_result(conn)?;

        Ok(Self {
            orders_by_status,
            currencies,
            product_sales,
            stock,
            deliveries,
            shipments_in_transit,
            stale_processing: order_crud::count_stale_processing(conn)?,
            subscribers: newsletter::stats(conn)?,
            customers: customer_crud::count_verified(conn)?,
            checkout_enabled: settings_crud::is_checkout_enabled(conn)?,
        })
    }
}

fn encode_family<M: EncodeMetric, L: EncodeLabelSet>(
    encoder: &mut DescriptorEncoder,
    name: &str,
    help: &str,
    series: impl IntoIterator<Item = (L, M)>,
) -> Result<(), std::fmt::Error> {
    let mut series = series.into_iter().peekable();
    let Some((_, first)) = series.peek() else {
        return Ok(());
    };
    let mut metric_encoder = encoder.encode_descriptor(name, help, None, first.metric_type())?;
    for (labels, metric) in series {
        metric.encode(metric_encoder.encode_family(&labels)?)?;
    }
    Ok(())
}

fn encode_gauge(
    encoder: &mut DescriptorEncoder,
    name: &str,
    help: &str,
    value: i64,
) -> Result<(), std::fmt::Error> {
    let gauge = ConstGauge::new(value);
    gauge.encode(encoder.encode_descriptor(name, help, None, gauge.metric_type())?)
}

fn major_units(cents: i64) -> f64 {
    cents as f64 / 100.0
}

fn status_label(status: OrderStatus) -> &'static str {
    match status {
        OrderStatus::Pending => "pending",
        OrderStatus::Processing => "processing",
        OrderStatus::Paid => "paid",
        OrderStatus::Expired => "expired",
        OrderStatus::Failed => "failed",
    }
}

impl Collector for ShopSnapshot {
    fn encode(&self, mut encoder: DescriptorEncoder) -> Result<(), std::fmt::Error> {
        let currency = |c: &CurrencyTotals| [("currency", c.currency.clone())];
        let product = |id: &str| [("product_id", id.to_string())];
        let product_currency = |s: &ProductSales| {
            [
                ("product_id", s.product_id.clone()),
                ("currency", s.currency.clone()),
            ]
        };

        encode_family(
            &mut encoder,
            "shop_orders",
            "Orders by their current status",
            self.orders_by_status
                .iter()
                .map(|(status, n)| ([("status", status_label(*status))], ConstGauge::new(*n))),
        )?;
        encode_family(
            &mut encoder,
            "shop_checkouts",
            "Checkouts started (orders created)",
            self.currencies
                .iter()
                .map(|c| (currency(c), ConstCounter::new(c.checkouts as u64))),
        )?;
        encode_family(
            &mut encoder,
            "shop_paid_orders",
            "Orders paid",
            self.currencies
                .iter()
                .map(|c| (currency(c), ConstCounter::new(c.paid_orders as u64))),
        )?;
        encode_family(
            &mut encoder,
            "shop_paid_revenue",
            "Revenue of paid orders, in major currency units",
            self.currencies
                .iter()
                .map(|c| (currency(c), ConstCounter::new(major_units(c.paid_cents)))),
        )?;
        encode_family(
            &mut encoder,
            "shop_bottles_sold",
            "Bottles in paid orders per product",
            self.product_sales
                .iter()
                .map(|s| (product_currency(s), ConstCounter::new(s.bottles as u64))),
        )?;
        encode_family(
            &mut encoder,
            "shop_product_revenue",
            "Revenue of paid orders per product, in major currency units",
            self.product_sales.iter().map(|s| {
                (
                    product_currency(s),
                    ConstCounter::new(major_units(s.revenue_cents)),
                )
            }),
        )?;
        encode_family(
            &mut encoder,
            "shop_stock_bottles",
            "Bottles on sale per product (0 means sold out)",
            self.stock
                .iter()
                .map(|s| (product(&s.product_id), ConstGauge::new(s.available))),
        )?;
        encode_family(
            &mut encoder,
            "shop_reserved_bottles",
            "Bottles held by unfinished checkouts per product",
            self.stock
                .iter()
                .map(|s| (product(&s.product_id), ConstGauge::new(s.reserved))),
        )?;
        encode_family(
            &mut encoder,
            "shop_paid_orders_by_delivery",
            "Orders paid per delivery method",
            self.deliveries.iter().map(|d| {
                (
                    [("method", d.method.clone())],
                    ConstCounter::new(d.paid_orders as u64),
                )
            }),
        )?;
        encode_family(
            &mut encoder,
            "shop_shipping_revenue",
            "Shipping charged on paid orders per delivery method, in RON (included in shop_paid_revenue)",
            self.deliveries.iter().map(|d| {
                (
                    [("method", d.method.clone())],
                    ConstCounter::new(major_units(d.shipping_cents)),
                )
            }),
        )?;
        encode_gauge(
            &mut encoder,
            "shop_shipments_in_transit",
            "Sameday waybills not yet delivered or cancelled",
            self.shipments_in_transit,
        )?;
        encode_gauge(
            &mut encoder,
            "shop_stale_processing_orders",
            "Delayed payments Stripe has not resolved within STALE_PROCESSING_DAYS",
            self.stale_processing,
        )?;
        encode_gauge(
            &mut encoder,
            "shop_checkout_enabled",
            "1 while the shop accepts orders, 0 while checkout is switched off",
            self.checkout_enabled.into(),
        )?;
        encode_gauge(
            &mut encoder,
            "shop_customers",
            "Customer accounts with a verified email",
            self.customers,
        )?;
        encode_family(
            &mut encoder,
            "shop_newsletter_subscribers",
            "Newsletter sign-ups by state",
            [
                (
                    [("state", "confirmed")],
                    ConstGauge::new(self.subscribers.confirmed),
                ),
                (
                    [("state", "pending")],
                    ConstGauge::new(self.subscribers.pending),
                ),
            ],
        )
    }
}

async fn serve_metrics(State(app_state): State<Arc<AppState>>) -> Response {
    let mut registry = Registry::default();
    registry.register(
        "http_requests",
        "HTTP requests handled",
        HTTP_REQUESTS.clone(),
    );
    registry.register(
        "http_request_duration_seconds",
        "HTTP request handling time",
        HTTP_DURATION.clone(),
    );
    registry.register(
        "task_failures",
        "Failed background task runs",
        TASK_FAILURES.clone(),
    );
    registry.register(
        "account_logins",
        "Customer password checks by outcome",
        ACCOUNT_LOGINS.clone(),
    );
    analytics::register(&mut registry);

    let snapshot = db::get_db_connection(&app_state)
        .map_err(|e| format!("{e:?}"))
        .and_then(|mut conn| ShopSnapshot::load(&mut conn).map_err(|e| e.to_string()));
    match snapshot {
        Ok(snapshot) => registry.register_collector(Box::new(snapshot)),
        Err(error) => {
            tracing::error!(%error, "failed to read shop metrics");
            record_failure(Task::shop_metrics);
        }
    }

    let mut body = String::new();
    if let Err(e) = text::encode(&mut body, &registry) {
        tracing::error!(error = %e, "failed to encode metrics");
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    (
        [(
            header::CONTENT_TYPE,
            "application/openmetrics-text; version=1.0.0; charset=utf-8",
        )],
        body,
    )
        .into_response()
}

/// Router for the internal metrics listener; never mounted on the public port.
pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/metrics", get(serve_metrics))
        .with_state(app_state)
}
