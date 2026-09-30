use std::{env, net::SocketAddr, sync::Arc};

use axum::{Router, extract::DefaultBodyLimit, routing::post};
use dotenvy::dotenv;

use backend::routes;
use backend::{
    AppState, account, auth, build_account_limiter, build_admin_limiter, build_checkout_limiter,
    build_customer_password_limiter, build_events_limiter, build_image_serve_limiter,
    build_login_limiter, build_newsletter_limiter, build_public_api_limiter, db, exchange_rate,
    google, mailer, metrics, newsletter, retention, sameday, shipments, site_mode, stripe_checkout,
    tokens,
};

struct Config {
    database_url: String,
    allowed_origin: String,
    backend_port: u16,
    metrics_addr: SocketAddr,
    jwt_secret: String,
    jwt_expiration_hours: i64,
    image_upload_dir: String,
    stripe_secret_key: String,
    stripe_webhook_secret: String,
    smtp: mailer::SmtpConfig,
    google: Option<google::GoogleConfig>,
    sameday: Option<sameday::SamedayConfig>,
    site_mode: site_mode::SiteMode,
}

/// Read `name` from the env, recording it in `missing` (and returning an
/// empty string) if absent. The caller checks `missing` after reading every
/// required var so a single error message can list every missing key.
fn required(name: &'static str, missing: &mut Vec<&'static str>) -> String {
    env::var(name).unwrap_or_else(|_| {
        missing.push(name);
        String::new()
    })
}

impl Config {
    fn from_env() -> Result<Self, String> {
        let mut missing = Vec::<&str>::new();

        let database_url = required("DATABASE_URL", &mut missing);
        let allowed_origin = required("ALLOWED_ORIGIN", &mut missing);
        let backend_port_str = required("BACKEND_PORT", &mut missing);
        let metrics_addr_str = required("METRICS_ADDR", &mut missing);
        let jwt_secret = required("JWT_SECRET", &mut missing);
        let jwt_expiration_hours_str = required("JWT_EXPIRATION_HOURS", &mut missing);
        let image_upload_dir = required("IMAGE_UPLOAD_DIR", &mut missing);
        let stripe_secret_key = required("STRIPE_SECRET_KEY", &mut missing);
        let stripe_webhook_secret = required("STRIPE_WEBHOOK_SECRET", &mut missing);
        let smtp_host = required("SMTP_HOST", &mut missing);
        let smtp_port_str = required("SMTP_PORT", &mut missing);
        let smtp_security_str = required("SMTP_SECURITY", &mut missing);
        let smtp_username = required("SMTP_USERNAME", &mut missing);
        let smtp_password = required("SMTP_PASSWORD", &mut missing);
        let smtp_from_address = required("SMTP_FROM_ADDRESS", &mut missing);
        let smtp_from_name = required("SMTP_FROM_NAME", &mut missing);

        if !missing.is_empty() {
            return Err(format!(
                "Missing required environment variables: {}",
                missing.join(", ")
            ));
        }

        let site_mode = site_mode::SiteMode::from_env()?;
        site_mode.check_stripe_key(&stripe_secret_key)?;

        let backend_port = backend_port_str
            .parse::<u16>()
            .map_err(|_| "BACKEND_PORT must be a valid port number (0-65535)".to_string())?;
        let metrics_addr = metrics_addr_str
            .parse::<SocketAddr>()
            .ok()
            .filter(|addr| addr.port() != backend_port && !addr.ip().is_unspecified())
            .ok_or(
                "METRICS_ADDR must be an ip:port on a specific interface, with a port other than BACKEND_PORT",
            )?;
        let smtp = mailer::SmtpConfig {
            host: smtp_host,
            port: smtp_port_str
                .parse::<u16>()
                .map_err(|_| "SMTP_PORT must be a valid port number (0-65535)".to_string())?,
            security: smtp_security_str.parse()?,
            username: smtp_username,
            password: smtp_password,
            from_address: smtp_from_address,
            from_name: smtp_from_name,
        };

        // Create the upload dir if missing, canonicalize it, and probe writability.
        // Doing this once at startup avoids a misconfigured `IMAGE_UPLOAD_DIR=/etc`
        // silently corrupting the host the first time someone uploads a file.
        std::fs::create_dir_all(&image_upload_dir).map_err(|e| {
            format!(
                "IMAGE_UPLOAD_DIR `{}` could not be created: {}",
                image_upload_dir, e
            )
        })?;
        let canonical_upload_dir = std::fs::canonicalize(&image_upload_dir)
            .map_err(|e| {
                format!(
                    "IMAGE_UPLOAD_DIR `{}` could not be canonicalized: {}",
                    image_upload_dir, e
                )
            })?
            .to_string_lossy()
            .into_owned();
        let probe = std::path::Path::new(&canonical_upload_dir).join(".write_probe");
        std::fs::write(&probe, b"").map_err(|e| {
            format!(
                "IMAGE_UPLOAD_DIR `{}` is not writable: {}",
                canonical_upload_dir, e
            )
        })?;
        let _ = std::fs::remove_file(&probe);
        let image_upload_dir = canonical_upload_dir;

        let parsed_jwt_expiration_hours = jwt_expiration_hours_str
            .parse::<i64>()
            .map_err(|_| "JWT_EXPIRATION_HOURS must be a valid integer".to_string())?;

        const JWT_EXP_MIN_HOURS: i64 = 1;
        const JWT_EXP_MAX_HOURS: i64 = 24;
        let jwt_expiration_hours =
            parsed_jwt_expiration_hours.clamp(JWT_EXP_MIN_HOURS, JWT_EXP_MAX_HOURS);
        if jwt_expiration_hours != parsed_jwt_expiration_hours {
            tracing::warn!(
                requested = parsed_jwt_expiration_hours,
                clamped = jwt_expiration_hours,
                "JWT_EXPIRATION_HOURS clamped to [{}, {}]",
                JWT_EXP_MIN_HOURS,
                JWT_EXP_MAX_HOURS
            );
        }

        Ok(Config {
            database_url,
            allowed_origin,
            backend_port,
            metrics_addr,
            jwt_secret,
            jwt_expiration_hours,
            image_upload_dir,
            stripe_secret_key,
            stripe_webhook_secret,
            smtp,
            google: google_config()?,
            sameday: sameday_config()?,
            site_mode,
        })
    }
}

/// Google sign-in is optional: both variables set enables it, neither
/// disables it, and only one is a configuration error.
fn google_config() -> Result<Option<google::GoogleConfig>, String> {
    let read = |name| env::var(name).ok().filter(|v| !v.trim().is_empty());
    match (read("GOOGLE_CLIENT_ID"), read("GOOGLE_CLIENT_SECRET")) {
        (Some(client_id), Some(client_secret)) => Ok(Some(google::GoogleConfig {
            client_id,
            client_secret,
        })),
        (None, None) => Ok(None),
        _ => Err("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together".to_string()),
    }
}

/// Sameday is optional: the API credentials enable waybills, and with
/// SAMEDAY_LOCKER_CLIENT_ID also easybox; none leaves home delivery with
/// waybills made by hand in eAWB.
fn sameday_config() -> Result<Option<sameday::SamedayConfig>, String> {
    let read = |name| env::var(name).ok().filter(|v| !v.trim().is_empty());
    let locker_client_id = read("SAMEDAY_LOCKER_CLIENT_ID");
    match (
        read("SAMEDAY_API_URL"),
        read("SAMEDAY_USERNAME"),
        read("SAMEDAY_PASSWORD"),
    ) {
        (Some(api_url), Some(username), Some(password)) => {
            if !api_url.starts_with("https://") {
                return Err("SAMEDAY_API_URL must be an https:// URL".to_string());
            }
            Ok(Some(sameday::SamedayConfig {
                api_url: api_url.trim_end_matches('/').to_string(),
                username,
                password,
                locker_client_id,
            }))
        }
        (None, None, None) if locker_client_id.is_none() => Ok(None),
        _ => Err(
            "SAMEDAY_API_URL, SAMEDAY_USERNAME and SAMEDAY_PASSWORD must be set together, and SAMEDAY_LOCKER_CLIENT_ID needs them"
                .to_string(),
        ),
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "backend=info,tower_http=info".parse().unwrap());

    // RUST_LOG_JSON=1 emits one JSON object per line; default is the
    // human-readable formatter for local development.
    if std::env::var("RUST_LOG_JSON").ok().as_deref() == Some("1") {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .json()
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    }

    let config = Config::from_env().unwrap_or_else(|e| {
        tracing::error!("{}", e);
        std::process::exit(1);
    });

    use axum::http::{HeaderValue, Method, header};
    use tower_http::cors::CorsLayer;

    let google = match config.google {
        Some(google_config) => Some(Arc::new(
            google::GoogleClient::new(google_config, &config.allowed_origin)
                .unwrap_or_else(|e| panic!("{e}")),
        )),
        None => {
            tracing::info!("GOOGLE_CLIENT_ID not set; Google sign-in disabled");
            None
        }
    };
    let sameday = match config.sameday {
        Some(sameday_config) => Some(Arc::new({
            if sameday_config.locker_client_id.is_none() {
                tracing::info!("SAMEDAY_LOCKER_CLIENT_ID not set; easybox disabled");
            }
            sameday::SamedayClient::new(sameday_config).unwrap_or_else(|e| panic!("{e}"))
        })),
        None => {
            tracing::info!("SAMEDAY_API_URL not set; easybox and waybills disabled");
            None
        }
    };
    if config.site_mode.is_dev() {
        tracing::info!("MODE=dev: the site asks for the dev access login");
    }
    let mailer = mailer::Mailer::new(config.smtp, config.site_mode.email_subject_prefix())
        .unwrap_or_else(|e| {
            tracing::error!("{}", e);
            std::process::exit(1);
        });

    let pool = db::establish_pooled_connection(&config.database_url)
        .expect("Failed to create database pool");

    // `AppState.site_url` is the canonical string form; CORS parses from it
    // so the two stay in lock-step (no chance of a trailing-slash drift).
    let app_state = Arc::new(AppState {
        pool,
        login_limiter: build_login_limiter(),
        image_serve_limiter: build_image_serve_limiter(),
        admin_limiter: build_admin_limiter(),
        public_api_limiter: build_public_api_limiter(),
        checkout_limiter: build_checkout_limiter(),
        newsletter_limiter: build_newsletter_limiter(),
        account_limiter: build_account_limiter(),
        customer_login_limiter: build_login_limiter(),
        customer_password_limiter: build_customer_password_limiter(),
        events_limiter: build_events_limiter(),
        dev_access_limiter: build_login_limiter(),
        client_key_secret: tokens::random_key(),
        site_url: config.allowed_origin,
        site_mode: config.site_mode,
        unsubscribe_key: newsletter::derive_unsubscribe_key(&config.jwt_secret),
        jwt_secret: config.jwt_secret,
        jwt_expiration_hours: config.jwt_expiration_hours,
        image_upload_dir: config.image_upload_dir,
        stripe_client: stripe::Client::new(config.stripe_secret_key),
        stripe_webhook_secret: config.stripe_webhook_secret,
        mailer,
        google,
        sameday,
        eur_rate: std::sync::RwLock::new(None),
    });

    // Warm the EUR rate cache from the database before serving so English
    // responses convert from the first request; the background task then
    // fetches fresh BNR rates daily.
    match db::get_db_connection(&app_state)
        .map(|mut conn| exchange_rate::latest_eur_rate(&mut conn))
    {
        Ok(Ok(Some(rate))) => app_state.set_eur_rate(rate),
        Ok(Ok(None)) => tracing::info!("no stored BNR EUR rate yet; awaiting first fetch"),
        Ok(Err(e)) => tracing::warn!(error = ?e, "failed to load stored BNR EUR rate"),
        Err(e) => tracing::warn!(error = ?e, "failed to load stored BNR EUR rate"),
    }
    tokio::spawn(exchange_rate::run_refresh_task(app_state.clone()));
    tokio::spawn(stripe_checkout::run_reservation_sweeper(app_state.clone()));
    tokio::spawn(stripe_checkout::run_processing_reconciler(
        app_state.clone(),
    ));
    tokio::spawn(newsletter::run_cleanup_task(app_state.clone()));
    tokio::spawn(account::run_cleanup_task(app_state.clone()));
    tokio::spawn(retention::run_retention_task(app_state.clone()));
    tokio::spawn(shipments::run_locker_sync(app_state.clone()));
    tokio::spawn(shipments::run_tracking_sync(app_state.clone()));

    let allowed_origin = app_state
        .site_url
        .parse::<HeaderValue>()
        .expect("ALLOWED_ORIGIN is not a valid header value");

    let cors = CorsLayer::new()
        .allow_origin(allowed_origin)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT_LANGUAGE])
        .expose_headers([header::VARY]);

    let admin_routes = Router::new()
        .merge(routes::product::admin_router())
        .merge(routes::checkout::admin_router())
        .merge(routes::shipping::admin_router())
        .merge(routes::blog::admin_router())
        .merge(routes::image::admin_router())
        .merge(routes::misc::admin_router())
        .merge(routes::newsletter::admin_router())
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth::auth_middleware,
        ))
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth::admin_rate_limit,
        ));

    let public_image_route = routes::image::public_serve_router().route_layer(
        axum::middleware::from_fn_with_state(app_state.clone(), auth::image_serve_rate_limit),
    );

    let public_api_routes = Router::new()
        .merge(routes::product::public_router())
        .merge(routes::checkout::public_router())
        .merge(routes::shipping::public_router())
        .merge(routes::blog::public_router())
        .merge(routes::lot::public_router())
        .merge(routes::newsletter::public_router())
        .merge(routes::account::router(app_state.clone()))
        .merge(routes::analytics::router(app_state.clone()))
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth::public_api_rate_limit,
        ));
    let metrics_router = metrics::router(app_state.clone());

    let dev_access_routes = if app_state.site_mode.is_dev() {
        routes::dev_access::router()
    } else {
        Router::new()
    };

    let app = Router::new()
        .merge(public_image_route)
        .merge(public_api_routes)
        .merge(routes::misc::unscoped_router())
        // Server-to-server Stripe endpoint: authenticated by signature
        // verification over the raw body, so no auth middleware or CORS needs.
        .merge(routes::checkout::webhook_router())
        .merge(dev_access_routes)
        .route("/api/admin/login", post(auth::login))
        .route("/api/admin/logout", post(auth::logout))
        .nest("/api/admin", admin_routes)
        .route_layer(axum::middleware::from_fn(metrics::track_http))
        .with_state(app_state)
        .layer(DefaultBodyLimit::max(256 * 1024)) // 256KB default; image upload route overrides to 50MB
        .layer(cors)
        .layer(
            tower_http::trace::TraceLayer::new_for_http().make_span_with(
                // Path only: query strings carry emailed tokens.
                |request: &axum::http::Request<axum::body::Body>| {
                    tracing::info_span!(
                        "request",
                        method = %request.method(),
                        path = %request.uri().path(),
                    )
                },
            ),
        );

    // Metrics listen only on the monitoring network's interface, so neither
    // nginx nor anything else on the frontend network can reach them.
    let metrics_addr = config.metrics_addr;
    let metrics_listener = tokio::net::TcpListener::bind(metrics_addr).await?;
    tokio::spawn(async move {
        if let Err(e) = axum::serve(metrics_listener, metrics_router).await {
            tracing::error!(error = %e, "metrics listener stopped");
        }
    });

    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("listening on {} (metrics on {})", addr, metrics_addr);
    axum::serve(listener, app.into_make_service()).await?;
    Ok(())
}
