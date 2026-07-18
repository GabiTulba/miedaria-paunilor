use std::{env, net::SocketAddr, sync::Arc};

use axum::{Router, extract::DefaultBodyLimit, routing::post};
use dotenvy::dotenv;

use backend::routes;
use backend::{
    AppState, auth, build_admin_limiter, build_image_serve_limiter, build_login_limiter,
    build_public_api_limiter, db,
};

struct Config {
    database_url: String,
    allowed_origin: String,
    backend_port: u16,
    jwt_secret: String,
    jwt_expiration_hours: i64,
    image_upload_dir: String,
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
        let jwt_secret = required("JWT_SECRET", &mut missing);
        let jwt_expiration_hours_str = required("JWT_EXPIRATION_HOURS", &mut missing);
        let image_upload_dir = required("IMAGE_UPLOAD_DIR", &mut missing);

        if !missing.is_empty() {
            return Err(format!(
                "Missing required environment variables: {}",
                missing.join(", ")
            ));
        }

        let backend_port = backend_port_str
            .parse::<u16>()
            .map_err(|_| "BACKEND_PORT must be a valid port number (0-65535)".to_string())?;

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
            jwt_secret,
            jwt_expiration_hours,
            image_upload_dir,
        })
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
        site_url: config.allowed_origin,
        jwt_secret: config.jwt_secret,
        jwt_expiration_hours: config.jwt_expiration_hours,
        image_upload_dir: config.image_upload_dir,
    });

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
        .merge(routes::blog::admin_router())
        .merge(routes::image::admin_router())
        .merge(routes::misc::admin_router())
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
        .merge(routes::blog::public_router())
        .merge(routes::lot::public_router())
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth::public_api_rate_limit,
        ));

    let app = Router::new()
        .merge(public_image_route)
        .merge(public_api_routes)
        .merge(routes::misc::unscoped_router())
        .route("/api/admin/login", post(auth::login))
        .route("/api/admin/logout", post(auth::logout))
        .nest("/api/admin", admin_routes)
        .with_state(app_state)
        .layer(DefaultBodyLimit::max(256 * 1024)) // 256KB default; image upload route overrides to 50MB
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("listening on {}", addr);
    axum::serve(listener, app.into_make_service()).await?;
    Ok(())
}
