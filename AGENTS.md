# Notes for AI Agents
## Scope
This document serves as high-level documentation for an app, describing the architecture, components, technologies, and features of the app.

## Coding Style and Code Quality
You write your code in a concise, easily readable way, only leaving inline doc-comments where to add additional behaviour information to the reader. The code should be mostly self-documenting. 

You try to avoid code duplication and prefer to factor out similar functionality in separate functions.

You do not want to go into any technical debt. Always implement features with a lot of carefulness, not leaving any feature partially implemented or comments about issues that should be implemented in the future.

You are concerned with security and possible vulnerabilities that the app could have, you try to reason about any form of malicious attack and try to avoid and mitigate them preemptively.

You should feel free to use the latest versions of docker images and programming languages.

## Updating the Documentation
Whenever you do significant feature or behaviour changes to the codebase, remember to update this AGENTS.md document. Your updates should be concise, summaries of the changes and always consider the rest of the information already present in this document, trying to keep the size of this document relatively small over time.

### Documentation Philosophy
This document should always reflect the **current state** of the project, not historical changes or diffs. When updating:
1. Describe features and architecture as they exist now
2. Avoid language like "new", "added", "removed", "updated", "changed" that describes transitions
3. Integrate improvements into the main description of systems
4. Remove sections that summarize historical refactoring
5. Present the project as a cohesive whole at a single point in time

## Build/Lint/Test Commands
**Backend (Rust):**
- Build: `cd backend && cargo build`
- Run: `cd backend && cargo run`
- Check: `cd backend && cargo check`
- Format: `cd backend && cargo fmt`
- Lint: `cd backend && cargo clippy`
- Test: `cd backend && cargo test` (no tests currently exist)

**Frontend (React/TypeScript):**
- Dev server: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Lint: `cd frontend && npm run lint`
- Preview: `cd frontend && npm run preview`

**Docker:**
- Start: `docker-compose up --build`
- Stop: `docker-compose down`

## Code Style Guidelines
**Rust Backend:**
- Use `cargo fmt` for consistent formatting
- Follow Rust naming conventions: snake_case for variables/functions, PascalCase for types
- Use `Result<T, AppError>` for error handling with unified `AppError` enum
- Group imports: std, external crates, internal modules
- Use `#[derive(...)]` for serialization/deserialization
- Prefer `async/await` with `tokio` runtime

**TypeScript/React Frontend:**
- Use TypeScript strict mode with explicit types
- Functional components with hooks, not classes
- PascalCase for components, camelCase for variables/functions
- Modular CSS: component-specific `.css` files
- Use React Context for global state (Auth, Cart)
- Prefer `react-router-dom` for routing
- Use environment variables via `import.meta.env`

**General:**
- No inline comments unless explaining complex logic
- Self-documenting code with descriptive names
- Avoid code duplication - extract reusable components/functions
- Security-first: validate inputs, handle errors gracefully
- Follow existing patterns in each codebase


# High Level Description
This project is the source code for a full-stack application for a e-commerce website for a mead making company called "Miedăria Păunilor".


# Docker Setup
## Containers
The app is built on top of Docker and has the following images:
* a frontend image -- built with React (`node:20.20.2-slim` builder, `nginx:1.30.0-alpine` runtime)
* a backend image -- built with Rust (`rust:1.95.0` builder, `debian:trixie-slim` runtime)
* a database image -- built with PostgreSQL
* a `prometheus` image (`prom/prometheus:v3.15.0`) -- scrapes the backend's metrics and keeps 2 years of history
* a `grafana` image (`grafana/grafana:13.2.2`) -- dashboards and email alerts, served by nginx at `/grafana/`
* a `mailpit` image (development only, `mail-dev` compose profile) -- catches outgoing email locally; its web UI is bound to `127.0.0.1:8025`


## Networks
The backend is the middle-man between the frontend and the database. For security reasons, the frontend is not on the same docker network as the database and the networks are:
* react-rust -- the frontend and the backend images share this network
* rust-postgres -- the backend and the database images share this network
* monitoring (internal, fixed subnet `172.31.99.0/24`) -- the backend (fixed IP `172.31.99.10`), Prometheus and Grafana
* grafana-web -- nginx to Grafana, and Grafana's outbound access to the SMTP relay

## Volumes
There are four volumes:
*   **postgres-data:** A volume for the PostgreSQL database.
*   **prometheus-data:** Prometheus's time-series database.
*   **grafana-data:** Grafana's own database (its admin account and sessions).
*   **miedaria_paunilor_images:** A volume for storing uploaded product images, mounted at `/app/images` in both the backend and frontend (Nginx) containers.

## Environment
All Docker images utilize environment variables defined in a single `.env` file located at the project root. The project includes an `env.sample` file as a template with all required variables and their default values.

### Environment Variables

*   **Database Configuration:**
    *   `POSTGRES_HOST`: PostgreSQL database host (default: `database`)
    *   `POSTGRES_PORT`: PostgreSQL database port (default: `5432`)
    *   `POSTGRES_USER`: PostgreSQL database user (default: `user`)
    *   `POSTGRES_PASSWORD`: PostgreSQL database password (default: `password`)
    *   `POSTGRES_DB`: PostgreSQL database name (default: `miedaria_paunilor`)
    *   `DATABASE_URL`: Full database connection URL (default: `postgres://user:password@database/miedaria_paunilor`)

*   **Authentication & Security:**
    *   `ADMIN_USERNAME`: Default administrator username for initial setup (default: `admin`)
    *   `ADMIN_PASSWORD`: Default administrator password for initial setup (default: `password`)
    *   `JWT_SECRET`: Secret key for JWT token generation and validation (default: `my-super-secret-key`)
    *   `JWT_EXPIRATION_HOURS`: Number of hours until a generated JWT token expires (default: `24`)
    *   `ALLOWED_ORIGIN`: Allowed CORS origin for the frontend (e.g., `https://yourdomain.com`; default: `https://localhost`)

*   **Backend Configuration:**
    *   `BACKEND_PORT`: The port on which the Rust backend server will listen (default: `8000`)
    *   `IMAGE_UPLOAD_DIR`: The directory where product images will be stored within the Docker container (default: `/app/images`)

*   **Monitoring:**
    *   `METRICS_ADDR`: Address of the backend's metrics listener, `172.31.99.10:9100` in Docker (the backend's IP on the monitoring network and the port in `monitoring/prometheus/prometheus.yml`); `127.0.0.1:9100` for `cargo run`. It must name a specific interface.
    *   `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`: Grafana's only account.
    *   `GRAFANA_ALERT_EMAIL`: Recipient of Grafana alerts, sent through the SMTP relay below.

*   **Sameday delivery (optional):**
    *   `SAMEDAY_API_URL` (`https://sameday-api.demo.zitec.com` demo, `https://api.sameday.ro` production), `SAMEDAY_USERNAME`, `SAMEDAY_PASSWORD`: API credentials from Sameday.
    *   `SAMEDAY_LOCKER_CLIENT_ID`: identifies the site to Sameday's easybox map.
    *   All four empty: home delivery only, with waybills made by hand in eAWB. Only some set fails startup.

*   **Google sign-in (optional):**
    *   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: a Google Cloud "Web application" OAuth client whose authorized redirect URI is `<ALLOWED_ORIGIN>/api/account/google/callback`. Both empty disables "Continue with Google"; only one set fails startup.

*   **Email (SMTP):**
    *   `SMTP_HOST`, `SMTP_PORT`: Relay address (production: Brevo, `smtp-relay.brevo.com:587`; local: `mailpit:1025`)
    *   `SMTP_SECURITY`: `starttls`, `tls` (implicit TLS) or `none` (Mailpit only)
    *   `SMTP_USERNAME`, `SMTP_PASSWORD`: Relay credentials
    *   `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`: Sender mailbox

*   **Frontend Configuration:**
    *   `VITE_API_BASE_URL`: The base URL for the backend API that the frontend will make requests to (default: `/api`)
    *   `VITE_BUSINESS_LEGAL_NAME`, `VITE_BUSINESS_TAX_ID`, `VITE_BUSINESS_TRADE_REGISTER_NO`: The data controller named in the privacy policy, baked in at build time (`BUSINESS_LEGAL` in `lib/businessInfo.ts`). `vite.config.ts` reads the root `.env` (`envDir: '..'`) and fails the build if any is blank; `env.sample` ships placeholders that must be replaced before launch.

**Setup Instructions:** Copy `env.sample` to `.env` and update values for your environment. The `.env` file is excluded from version control. **All default secrets (`POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `JWT_SECRET`) must be changed before any production deployment.**

### Security Hardening
*   **No exposed ports for database or backend** — only the frontend exposes ports 80 and 443 to the host. The backend (port 8000) and database (port 5432) are accessible only via internal Docker networks.
*   **Non-root containers** — the backend runs as `appuser` (via `gosu` in `entrypoint.sh`); the frontend runs as the `nginx` user.
*   **Resource limits and healthchecks** configured on all services in `docker-compose.yml`.
*   **Log retention:** every service uses the `json-file` driver capped at 5 × 10 MB, since the logs hold IP addresses and user agents. nginx and the backend log request paths without query strings, which carry emailed tokens.
*   **`.dockerignore`** files in both `backend/` and `frontend/` exclude `.env`, `.git`, `target/`, `node_modules/`, and `dist/` from build contexts.

### HTTPS Configuration
The application serves content over HTTPS (host port 443 → container port 8443) with HTTP (port 80 → 8080) redirecting to HTTPS. For development, self-signed certificates are generated using `generate-ssl.sh` (ECDSA P-384, 90-day expiry, with SAN). For production, replace certificates in the `ssl/` directory with Let's Encrypt certificates.

**SSL Certificate Generation:**
- Run `./generate-ssl.sh` to generate development certificates (stored in `ssl/`, mounted read-only into the nginx container)
- Certificates are created with `chmod 644` so the non-root nginx user can read them in the container
- For production, use certbot or another trusted CA

# Logical Components
## Database
### Technologies
This is a PostgreSQL database.

### Features
The instance has a single database [miedaria_paunilor]. Its main tables are:
1. [products]
2. [admin_users]
3. [images]
4. [blog_posts]
5. [customers] (see Customer Accounts)
6. [shipping_rates], [sameday_lockers], [shipments] (see Delivery)

[images] has the following schema:
* id - (Primary Key) A UUID generated by the database.
* file_name - The original name of the uploaded file. `VARCHAR(512)` (not unique — multiple uploads with the same filename are allowed; `storage_path` is the unique identifier).
* storage_path - The path where the file is stored on the filesystem (e.g., /app/images/UUID.ext). `VARCHAR(1024)`. Unique.
* created_at - Timestamptz of when the image was uploaded.
* file_size - Size of the file in bytes.

[blog_posts] has the following schema:
* id - (Primary Key) A UUID generated by the database.
* title - The title of the blog post in English.
* title_ro - The title of the blog post in Romanian.
* slug - URL-friendly identifier (lowercase letters, numbers, hyphens only). Unique.
* content_markdown - The blog post content in Markdown format (English).
* content_markdown_ro - The blog post content in Markdown format (Romanian).
* excerpt - Short summary for blog listing (English).
* excerpt_ro - Short summary for blog listing (Romanian).
* author - Author name.
* published_at - Nullable TIMESTAMPTZ. NULL for drafts, set automatically by the backend when a post is first published.
* updated_at - TIMESTAMPTZ, auto-updated by a database trigger on every UPDATE.
* is_published - Boolean indicating if the post is published or draft.

[products] has the following schema:
* product_id - (Primary Key) A short string composed of lowercase letters, dashes or underscores. `VARCHAR(128)`.
* product_name - A short string that supports any character. Represents the human-friendly name of the product in English. `VARCHAR(256)`.
* product_name_ro - A short string that supports any character. Represents the human-friendly name of the product in Romanian. `VARCHAR(256)`.
* product_description - A long, free-form text string. Represents a detailed description of the product in English.
* product_description_ro - A long, free-form text string. Represents a detailed description of the product in Romanian.
* ingredients - A text field for the ingredients of the product in English.
* ingredients_ro - A text field for the ingredients of the product in Romanian.
* product_type - PostgreSQL ENUM (`mead_type_enum`): hidromel, melomel, metheglin, bochet, braggot, pyment, cyser, rhodomel, capsicumel, acerglyn
* sweetness - PostgreSQL ENUM (`sweetness_type_enum`): bone-dry, dry, semi-dry, semi-sweet, sweet, dessert
* turbidity - PostgreSQL ENUM (`turbidity_type_enum`): crystalline, hazy, cloudy
* effervescence - PostgreSQL ENUM (`effervescence_type_enum`): flat, perlant, sparkling
* acidity - PostgreSQL ENUM (`acidity_type_enum`): mild, moderate, strong
* tannins - PostgreSQL ENUM (`tannins_type_enum`): mild, moderate, strong
* body - PostgreSQL ENUM (`body_type_enum`): light, medium, full
* abv - `DECIMAL(3,1)` with CHECK constraint (0.0–99.9). Represents the alcohol by volume concentration of the mead.
* bottle_count - Non-negative integer with CHECK constraint (>= 0). Represents the number of bottles in stock.
* bottle_size - Positive integer with CHECK constraint (> 0). Mililiters of volume.
* price_ron - `DECIMAL(7,2)` with CHECK constraint (> 0). Price in Romanian Lei — the single source of truth for pricing. EUR display prices are derived at read time from the BNR exchange rate (see Currency and Exchange Rates).
* image_id - (Foreign Key, Nullable) A UUID referencing `images.id`. Products can exist without an image.
* bottling_date - Date with CHECK constraint (<= CURRENT_DATE). Cannot be in the future.
* lot_number - Positive integer with CHECK constraint (> 0).
* weight_grams - Packed weight of one bottle (1–30000 g), for waybills and the easybox limit; admin-only.
* updated_at - TIMESTAMPTZ, auto-updated by a database trigger on every UPDATE.

[admin_users] has the following schema:
* username - (Primary Key) `VARCHAR(256)`.
* hashed_password - Argon2id PHC string (includes embedded salt, algorithm parameters, and hash). `VARCHAR(512)`.

Passwords are hashed with Argon2id via the `argon2` crate. The PHC string format embeds the salt and parameters, so no separate salt column is needed.

[newsletter_subscribers] holds the double opt-in mailing list: `id` (UUID), `email` (unique, lowercased, max 254), `language` (`en`/`ro`), `confirmed_at` (NULL until confirmed; the proof-of-consent timestamp), `confirmation_token_hash` (SHA-256 of the single-use token), `confirmation_sent_at`, `token_expires_at`, `created_at`. `blog_posts.notified_at` records when a post was last emailed to subscribers; a dedicated trigger keeps it from bumping `updated_at`, which is the post's sitemap/RSS lastmod.

All timestamp columns use `TIMESTAMPTZ` (timestamp with timezone). The `updated_at` columns on `products` and `blog_posts` are auto-managed by a shared `update_updated_at()` PostgreSQL trigger function. The `products` table has indexes on `product_type`, `bottle_count`, `bottling_date` (DESC), `sweetness`, and a partial index for in-stock products (`bottle_count > 0`). The `blog_posts` table has indexes on `published_at` (DESC), `slug`, and `is_published`. All numeric product fields have CHECK constraints enforcing valid ranges.

The database is initialized at container startup by the backend's `entrypoint.sh` using `diesel setup` (to create the database and run migrations) and then `add_admin_user` to create the default admin user with credentials from the root `.env` file.

## Backend
### Technologies
The backend acts as a middle-man between the frontend and the database. It is built with Rust and utilizes the following key libraries:
*   [axum] (v0.8.7) - A web application framework for handling user requests, routing, and API endpoints.
*   [diesel] (v2.2.0) - An ORM and query builder for database interactions, with the `r2d2`, `uuid`, and `chrono` features enabled.
*   [jsonwebtoken] (v10.2.0) - For JWT (JSON Web Token) signing and verification, with the `rust_crypto` feature enabled.
*   [tokio] (v1) - An asynchronous runtime for Rust.
*   [r2d2] (v0.8.10) - A connection pool for managing database connections.
*   [async-trait] (v0.1.80) - A procedural macro for async functions in traits.
*   [uuid] (v1.8.0) - For UUID generation and handling, with the `v4`, `fast-rng`, and `serde` features enabled.
*   [chrono] (v0.4.38) - For date and time handling, with the `serde` feature enabled.
*   [mime_guess] (v2.0) - For guessing MIME types based on file extensions.
*   [rust_decimal] (v1.39) - For precise decimal arithmetic with database support, with the `serde-with-float` feature enabled for JSON serialization as numbers.
*   [diesel-derive-enum] (v2.1.0) - Maps Rust enums to PostgreSQL ENUM types via `DbEnum` derive macro with `ExistingTypePath` and `DbValueStyle = "kebab-case"` attributes.
*   [argon2] (v0.5) - Argon2id password hashing.
*   [governor] (v0.6) - Token-bucket rate limiting for the login endpoint.
*   [tracing] (v0.1) + [tracing-subscriber] (v0.3) - Structured logging with `env-filter` support. Log level configurable via `RUST_LOG` environment variable (default: `backend=info,tower_http=info`).
*   [tower-http] (v0.6.7) - CORS and `TraceLayer` for request/response logging.

The backend is structured as a library crate (`lib.rs`) consumed by a main binary (`main.rs`) and a helper binary (`add_admin_user.rs`). Key modules include `account`, `analytics`, `auth`, `blog_crud`, `customer_crud`, `db`, `enum_crud`, `enums`, `error`, `image_crud`, `language`, `localized`, `metrics`, `models`, `product_crud`, `sameday`, `schema`, `shipments`, `shipping`, `sitemap_crud`, `tokens`, `user_crud`, and `utils`.

`AppState` holds the database connection pool, login rate limiter, and `site_url` (read from `ALLOWED_ORIGIN` env var) used by `sitemap_crud` to construct absolute URLs.

### Enums and Product Attributes
Product attribute enums are defined in `enums.rs` as Rust enums backed by PostgreSQL ENUM types. Each enum derives `diesel_derive_enum::DbEnum` for DB mapping, `serde` with `rename_all = "kebab-case"` for API serialization, and uses `#[DbValueStyle = "kebab-case"]` for DB value mapping. The Rust types, PostgreSQL types, and JSON API all use the same kebab-case string values (e.g., `"bone-dry"`, `"semi-sweet"`).

*   **MeadType** (`mead_type_enum`): Hidromel, Melomel, Metheglin, Bochet, Braggot, Pyment, Cyser, Rhodomel, Capsicumel, Acerglyn
*   **SweetnessType** (`sweetness_type_enum`): BoneDry, Dry, SemiDry, SemiSweet, Sweet, Dessert
*   **TurbidityType** (`turbidity_type_enum`): Crystalline, Hazy, Cloudy
*   **EffervescenceType** (`effervescence_type_enum`): Flat, Perlant, Sparkling
*   **AcidityType** (`acidity_type_enum`): Mild, Moderate, Strong
*   **TanninsType** (`tannins_type_enum`): Mild, Moderate, Strong
*   **BodyType** (`body_type_enum`): Light, Medium, Full

Enum validation is handled at two levels: serde rejects invalid values during JSON/query parameter deserialization (before any handler code runs), and PostgreSQL ENUM types reject invalid values at the database level. No manual enum validation exists in application code.

**Enum API Endpoint:** The backend provides a `/api/enums` GET endpoint that returns all enum values with their string representations and bilingual display labels (English and Romanian). String values are derived from serde serialization of each enum variant. This eliminates duplication between frontend and backend.

**Frontend Enum Integration:** The frontend uses the `useFetchEnums` hook to fetch enum values from the backend. All components use the `getEnumLabel(value, enumType, t)` utility function from `enums.ts` for consistent translated enum labels. The function maps `EnumValues` keys (e.g., `mead_type`) to translation keys (e.g., `meadType`) via `ENUM_TYPE_TO_TRANSLATION_KEY`, with a `formatEnumLabel` fallback for missing translations. The `EnumContext` validates the API response shape on receipt — if any expected enum key is missing or not an array, it sets an error state and discards the response rather than storing malformed data.

### Features
Axum is used to interact with the frontend, dealing with:
*   User requests to various API endpoints (e.g., `/api/products`, `/api/admin/login`, `/api/enums`).
*   Routing, including dynamic path parameters (e.g., `/api/products/{product_id}`, `/images/{image_id}`).
*   User authentication and authorization using JWTs, with an `Auth` extractor (`auth.rs`) to protect admin routes.
*   CORS middleware is restricted to the origin specified by the `ALLOWED_ORIGIN` environment variable, applied specifically to admin routes for proper preflight handling.
*   **Login Rate Limiting:** The `/api/admin/login` endpoint enforces a token-bucket limit of 10 requests per minute per client IP (extracted from `X-Real-IP` / `X-Forwarded-For` headers). Excess requests receive HTTP 429.
*   **Request Logging:** `tower_http::trace::TraceLayer` logs all incoming requests and responses via the `tracing` framework.
*   **Unified Error Handling:** The `AppError` enum serves as a unified error type for all API handlers, providing `From` implementations for various specific errors (e.g., `diesel::result::Error`, product CRUD errors, authentication errors) and an `IntoResponse` implementation for consistent HTTP response generation.
*   **Centralized Database Connection Acquisition:** The `db::get_db_connection` helper function centralizes the logic for acquiring a database connection from the application's connection pool, reducing boilerplate code in handler functions.
*   **Accept-Language Content Negotiation:** Public GET endpoints (`/api/products`, `/api/products/{id}`, `/api/blog`, `/api/blog/{slug}`) use a `Language` Axum extractor (`language.rs`) to parse the `Accept-Language` header. Responses contain single-language fields via `LocalizedProduct`, `LocalizedProductWithImage`, and `LocalizedBlogPost` structs (`localized.rs`). Price is returned with a `currency` field: RON for Romanian, and for English an indicative EUR amount derived from the BNR rate with `is_converted: true` and the `rate_date` used (falling back to RON if no rate is known yet). All localized responses include a `Vary: Accept-Language` header. Admin endpoints continue to return full bilingual data. A dedicated `GET /api/admin/products/{product_id}` endpoint returns the full `ProductWithImage` for admin edit forms.

### Currency and Exchange Rates
RON is the only currency prices are entered and charged in. The `exchange_rates` table stores daily official BNR reference rates (`currency`, `rate_date`, `rate DECIMAL(10,4)`, `fetched_at`; primary key `(currency, rate_date)`), populated by `exchange_rate.rs`: a background task fetches `https://curs.bnr.ro/nbrfxrates.xml` on startup and daily at 13:10 Europe/Bucharest (retrying every 15 minutes on failure), parses the EUR rate with `quick-xml`, validates it against a plausibility range, and upserts it. The latest rate is cached in `AppState` (`RwLock<Option<EurRate>>`) so request handlers never query the database for conversion. The English site receives an indicative EUR price computed as `price_ron / rate` rounded half-up to 2 decimals; the frontend marks such prices with `*` and renders an `EurConversionNote` footnote naming the rate date. `GET /api/exchange-rate` (public, unscoped) returns the cached rate or `null`. Stripe Checkout Sessions are always created in RON regardless of site language.

### Checkout and Orders
`POST /api/checkout/session` (public) creates a pending order and a Stripe Checkout Session. Accounts are never required; when the request carries a customer session, the order gets its `customer_id` and Stripe's `customer_email` is set to the account's address. Adding to the cart never touches the database; stock is checked and reserved atomically only here, right before the redirect to Stripe, with prices recomputed server-side. A reservation is held for 15 minutes (`order_crud::HOLD_SECS`). Stripe's minimum session lifetime is 30 minutes, so the reservation sweeper (`stripe_checkout::run_reservation_sweeper`, every minute) expires the Stripe session itself before releasing the stock of any order still `pending` past the hold. If the session turns out to be complete, it applies the completion instead. The sweeper is also the safety net for orders left pending by a crash, a failed release on an error path, or a missing webhook. Because reservations hold real stock, abuse is bounded three ways: a dedicated per-client limiter (burst of 5, then one per 2 minutes), at most 2 live pending orders per client (enforced in the order transaction under a per-client advisory lock), and at most 100 bottles per order (`MAX_ORDER_BOTTLES`, mirrored and enforced by the frontend cart). Clients are keyed by IP with IPv6 collapsed to its /64 (`auth::client_network`). Orders store only `client_key_hash`, an HMAC of that network under a random key that lives in process memory, cleared as soon as the order leaves `pending`.

Order statuses: `pending` (stock held, customer on Stripe), `processing` (checkout completed with a delayed payment method that has not settled; stock stays held and is exempt from the 15-minute hold), `paid`, `expired`, `failed`. `POST /api/webhooks/stripe` verifies the Stripe signature over the raw body. `checkout.session.completed` moves the order to `paid` when `payment_status` is `paid` (or `no_payment_required`), otherwise to `processing`. `checkout.session.async_payment_succeeded` moves it to `paid`. `checkout.session.async_payment_failed` and `checkout.session.expired` release the stock (`failed` / `expired`). Orders are resolved by the attached session id, falling back to the signed `order_id` session metadata. Webhook and sweeper share the transition logic in `stripe_checkout.rs`, and every transition only applies from a stock-holding status, so retries and webhook/sweeper races are idempotent. The Stripe webhook endpoint must be subscribed to all four `checkout.session.*` events.

### Delivery (Sameday)
Orders ship with Sameday, to the door or to an easybox locker, chosen in the cart (`CartDelivery`).
*   **Pricing** (`shipping.rs`): `shipping_rates` holds a flat RON price per method, free once the products reach `free_from_cents` (seeded at 20 RON home, 15 RON easybox, free from 250 RON), edited on the admin **Shipping** page. `GET /api/shipping/options` returns the enabled methods in the visitor's currency (`LocalizedShippingRate`, indicative EUR on the English site) and, when easybox is offered, the ids the locker map needs.
*   **Checkout:** `CheckoutSessionRequest` carries `delivery` (`home`, or `easybox` with a `locker_id`) and `adult_confirmed`, which must be true (the cart's 18+ checkbox; stored as `orders.age_confirmed_at`). Inside the stock-reserving transaction the delivery is priced and checked: the method must be enabled, the locker must be in `sameday_lockers` (its address is copied from there onto the order, never from the browser), easybox needs Sameday configured, and an easybox parcel may weigh at most `MAX_LOCKER_GRAMS` (18 kg of `weight_grams`). `orders.total_amount_cents` includes `shipping_amount_cents`; `order_items` hold the products alone. Stripe gets the charge as a single `shipping_options` entry. Home delivery keeps Stripe's Romania-only address collection; easybox collects no address, only a required `recipient_name` custom field. Both collect the phone number.
*   **Easybox map** (`lib/lockerMap.ts`): Sameday's script (`cdn.sameday.ro`) is loaded only when the customer clicks "Choose an easybox"; it opens an iframe from `lockerplugin.sameday.ro`, the only third-party frame and geolocation delegate the CSP and Permissions-Policy allow. The choice is kept in the `easybox_locker` sessionStorage key.
*   **Sameday client** (`sameday.rs`): REST API with PHP-style bracket form bodies and JSON responses. The token (`X-AUTH-TOKEN`, 14 days with `remember_me`; authentication is limited to 12 a minute per IP) is cached and renewed once on 401/403. Service ids (`24` home, `LN` easybox) and the default pickup point are looked up, never hard-coded, since they differ between demo and production.
*   **Waybills** (`shipments.rs`, `routes/shipping.rs`): on the admin orders page a paid order gets **Generate AWB** (parcels, weight pre-filled from `weight_grams`, optional declared value), which creates the AWB (`oohLastMile` and the locker's address for easybox, `packageType` from the parcel weight, a fresh `clientInternalReference` per AWB), stores it in `shipments` (one per order) and emails the customer a bilingual "on its way" message with the tracking link (`https://sameday.ro/#awb=`). A failed insert cancels the AWB at Sameday again. **Download label** proxies the A6 PDF; **Cancel AWB** deletes it before pickup. Sameday rejections are shown to the admin with Sameday's message (409); an unreachable or unconfigured Sameday answers 503.
*   **Background tasks:** `run_locker_sync` replaces `sameday_lockers` on startup and daily (hourly while failing; an empty answer keeps the old list) and refreshes the service ids. `run_tracking_sync` polls each undelivered AWB under 30 days old every 30 minutes (Sameday has no webhooks), storing the status, delivery time and cancellation. Failures count as `task_failures_total{task="sameday_lockers"|"sameday_tracking"}`.
*   **Views:** `DeliveryDetails` shows the method, the address or locker, the phone and the AWB with its status on the admin and account order pages.

### Order Retention
`retention.rs` enforces storage limitation (GDPR art. 5(1)(e)). A task runs on startup and daily, calling `order_crud::anonymize_expired`, which erases an order's personal data: `customer_email`, the shipping fields, the locker snapshot, the AWB number, `customer_id`, the Stripe session and payment intent ids, and `client_key_hash`. It then sets `orders.anonymized_at`. Amounts, currency, status, dates and `order_items` stay, so the accounting totals and the `shop_*` metrics are unchanged.
*   **Paid orders** are kept for 5 years from the end of their financial year (Legea contabilității nr. 82/1991). They are erased once `created_at` falls before 1 January (Bucharest time) of the year five years before the current one (`accounting_cutoff`), so a 2026 order is erased in January 2032.
*   **Expired and failed orders** are erased 90 days after they ended (`updated_at`). Pending and processing orders are never touched.
*   The admin orders page shows erased orders as such. Failures count as `task_failures_total{task="order_retention"}`, which fires the existing Grafana alert.

### Customer Accounts
Optional accounts for order history (`account.rs`, `customer_crud.rs`, `routes/account.rs`), completely separate from admin auth: own tables, cookie, middleware and routes, so neither credential can reach the other's endpoints.
*   **Tables:** `customers` (`id`, `email` unique and lowercased, `hashed_password` Argon2id or NULL, `email_verified_at` (set once ownership of the inbox is proven), `language`, timestamps; a password requires a verified address). `customer_identities` links sign-in providers by their stable subject id (`provider`, `subject`, `customer_id`; one per provider per account). `customer_tokens` holds emailed single-use tokens (`purpose` `set-password` / `change-email`, SHA-256 `token_hash`, `new_email` for email changes, `expires_at`), one live token per customer and purpose. `customer_sessions` holds sessions by SHA-256 `token_hash`. `orders.customer_id` references `customers` with `ON DELETE SET NULL`.
*   **Email-first registration:** `POST /api/account/register` (`{email}`) creates a password-less row and emails a link; the password is chosen on that link (`POST /api/account/set-password`), which verifies the address. Only the inbox owner can therefore set a password, so nobody can pre-register someone else's address and read their linked orders. For an address that already has an account the email offers a reset link instead. `POST /api/account/password-reset` uses the same set-password flow. Registration and reset always answer 204. Token lifetimes are 24 h (registration and email change) and 1 h (reset), and each purpose sends at most one email per account per 10 minutes. Unfinished registrations are purged hourly.
*   **Sessions:** a 256-bit random token in the `__Host-customer_session` cookie (HttpOnly, Secure, `SameSite=Strict`, `Path=/`), stored only as a hash. A session ends after 7 days idle or 30 days in all (`last_seen_at` is refreshed at most hourly), at most 10 per account are kept, every login issues a new token, and setting or changing the password or email ends the other sessions. `GET /api/account/me` answers the profile or `null`.
*   **Passwords:** 10–128 characters, rejected if among the 10,000 most common passwords of that length (`common_passwords.txt`) or containing the email's local part. Hashing and verification run in `spawn_blocking`. Unknown addresses are verified against the admin dummy hash, so timing does not reveal accounts. Every password check (login, and re-authentication for email change, password change, export and deletion) is limited per client network (10 per minute) and per account (burst of 10, then one per minute, keyed by an HMAC of the address under the per-process key), and counted in `account_logins_total{result}`.
*   **Same-origin guard:** every non-GET `/api/account` request whose `Origin` is not `ALLOWED_ORIGIN`, or whose `Sec-Fetch-Site` is present and not `same-origin`, is rejected with 403.
*   **Orders:** orders placed while logged in are linked at checkout. When an address is verified (password set or email change confirmed), guest orders with that `customer_email` are linked, and a completed guest checkout whose Stripe email matches a verified account is linked by `apply_completed_session`. `GET /api/account/orders` and `/orders/{id}` list the customer's `processing`, `paid` and `failed` orders; another customer's order answers 404.
*   **Google sign-in** (`google.rs`, `routes/account_google.rs`): OpenID Connect authorization code flow with PKCE, entirely server-side, so no Google script or cookie loads on the site. `GET /api/account/google/start?intent=` (`sign-in`, `link` or `reauth`) redirects to Google and sets `__Host-google_flow` (HttpOnly, Secure, `SameSite=Lax` so it survives the return navigation, 10 minutes) holding the `state`, `nonce`, PKCE verifier, intent, return path and, for `link`/`reauth`, the hash of the session that asked. `GET /api/account/google/callback` checks `state` in constant time, exchanges the code with the client secret, verifies the ID token against Google's cached JWKS (RS256, issuer, audience, expiry, nonce) and requires `email_verified`, then redirects to the site with `?google=<outcome>` (`GoogleNotice` shows it). The flow cookie is cleared on every callback.
    *   **Sign-in** logs in the account linked to the Google `sub`. An unknown `sub` gets a new account only if its address has no established account (one with a password or a linked sign-in); unfinished registrations are adopted. An established address is never taken over: its owner logs in and connects Google from Settings (`intent=link`, which Google re-prompts with `max_age=0`).
    *   **Address ownership:** Google is authoritative only for Gmail and for Workspace addresses matching the `hd` claim (`email_is_authoritative`). Only then does a Google sign-in verify the account's address and link guest orders. For other addresses an emailed link is still needed, and using one (`set_password`) removes a Google link made while the address was unverified.
    *   **Accounts without a password** confirm email change, export and deletion by signing in with Google again (`intent=reauth` replaces the session; `CurrentCustomer::recently_signed_in` accepts sessions under 10 minutes old, reported as `reauthenticated_until`). They can add a password through the reset link. `DELETE /api/account/google` (with `current_password`) unlinks Google, allowed only once the account has a password. Linking and unlinking email a notice. `GET /api/account/providers` tells the frontend whether Google is enabled.
*   **Settings and GDPR:** `POST /api/account/email` emails a confirmation link to the new address and a notice to the old one (the change happens on `POST /api/account/email/confirm`), `POST /api/account/password`, `POST /api/account/logout-all`, `POST /api/account/export` (JSON download of profile, linked sign-ins, orders and newsletter subscription) and `DELETE /api/account` (orders stay, detached). Each needs `current_password`, or a recent Google sign-in for an account without one. Password changes and deletions email a notice.

### Newsletter
`newsletter.rs` holds the list logic and email templates; `mailer.rs` wraps a pooled `lettre` SMTP transport (rustls) whose sends run in spawned tasks, logging failures without the recipient address. Batch sends are throttled to 4 messages per second.
*   `POST /api/newsletter/subscribe` (`{email}`, language from `Accept-Language`): answers 204 for any valid address, whether new, pending or already confirmed, so the list cannot be probed. It has its own per-client limiter (burst of 5, then one per 2 minutes), and a pending address gets at most one confirmation email per 10 minutes. The emailed token is 256-bit random, stored only as a hash, single-use and valid for 48 hours.
*   `POST /api/newsletter/confirm` (`{token}`) activates the subscription. The link lands on a frontend page that POSTs, so mail-filter link scanners cannot confirm on a recipient's behalf.
*   `POST /api/newsletter/unsubscribe?id=&token=` deletes the row (right to erasure). The token is an HMAC of the subscriber id under a key derived from `JWT_SECRET` (domain-separated), so no unsubscribe secret is stored and rotating `JWT_SECRET` invalidates old links. The same URL serves RFC 8058 one-click unsubscribe (`List-Unsubscribe` / `List-Unsubscribe-Post` headers on every list email).
*   Admin: `GET /api/admin/newsletter/stats` (confirmed and pending counts only; addresses are never exposed) and `POST /api/admin/blog/{id}/notify` (`{resend}`) which emails a published post to all confirmed subscribers in their own language. A row lock plus `notified_at` makes a post go out once unless `resend` is set.
*   An hourly task purges sign-ups whose confirmation expired unused.

### Metrics and Monitoring
`metrics.rs` serves Prometheus metrics (OpenMetrics text, `prometheus-client`) on a second listener bound to `METRICS_ADDR`, the backend's interface on the internal monitoring network, so nginx and the frontend network cannot reach it. No metric identifies a visitor.
*   **Request metrics:** `http_requests_total` (method, route, status) and `http_request_duration_seconds`, recorded by the `track_http` route layer. The route label is the route template (`/api/products/{product_id}`), never the raw path, and unmatched paths are not recorded.
*   **Background failures:** `task_failures_total{task}` is incremented next to the error log of each background job (BNR refresh, email delivery, newsletter purge, account purge, order retention, reservation sweep, processing reconciliation, shop metrics).
*   **Customer logins:** `account_logins_total{result}` counts customer password checks as `success`, `failure` or `throttled`.
*   **Site statistics** (`analytics.rs`): the browser reports events to `POST /api/events` (`lib/analytics.ts`), counted in memory only, with no cookie, storage or identifier.
    *   **Events and metrics:**
        *   `site_page_views_total{page, from, language}`: `from` is the previous page, or on a visit's first page the kind of referrer (`direct`, `search`, `social`, `email`, `other`).
        *   `shop_product_views_total`, `shop_cart_additions_total` and `shop_cart_limits_total` (more wanted than stock or the order limit allowed), each per `product_id`.
        *   `blog_post_views_total{slug}`.
        *   `shop_filter_uses_total{filter, value}` (the search box is never sent).
        *   `newsletter_popup_total{outcome}`.
    *   **Bounded labels:** every label comes from a serde enum or from the live catalog (product ids and published slugs are checked before counting), and referring hosts are reduced to their kind.
    *   **Daily visitors:** `site_visitors_total` counts each visitor once a day, by an HMAC of client network and user agent under an in-memory key that is replaced at midnight (Bucharest time) along with the day's hashes (at most 100,000 a day).
    *   **Not counted:** Do Not Track or Global Privacy Control (checked both in the browser and from the `DNT`/`Sec-GPC` headers), `navigator.webdriver`, and bot or headless user agents.
    *   **Abuse limits:** the endpoint has the account routes' same-origin guard, a 1 KB body limit and its own per-network limiter (60 a minute), and always answers 204 for a well-formed event.
*   **Shop figures:** read from the database on every scrape (so they survive restarts): `shop_checkouts_total`, `shop_paid_orders_total` and `shop_paid_revenue_total` (shipping included) per currency; `shop_paid_orders_by_delivery_total` and `shop_shipping_revenue_total` (RON) per delivery method; `shop_shipments_in_transit`; `shop_bottles_sold_total` and `shop_product_revenue_total` per product and currency; `shop_orders` by status; `shop_stock_bottles` and `shop_reserved_bottles` per product; `shop_stale_processing_orders`; `shop_newsletter_subscribers` by state; `shop_customers` (verified accounts); `shop_checkout_enabled` (the admin checkout toggle). Money is in major units. Every live product has a RON series from the start so `increase()` counts first sales. Sales over a range are `increase()` of these totals, so their history starts with Prometheus's; orders placed before that appear as a jump on the first scrape.
*   **Stale delayed payments:** orders in `processing` for more than `order_crud::STALE_PROCESSING_DAYS` (3, Stripe's webhook retry window), measured from `updated_at`. `stripe_checkout::run_processing_reconciler` runs on startup and daily: for each one it retrieves the PaymentIntent (from the order, or else its Checkout Session) and applies `succeeded` → `paid` and `canceled`/`requires_payment_method` → release stock as `failed`, through the same idempotent transitions as the webhook.

Prometheus (`monitoring/prometheus/prometheus.yml`) scrapes every 30 s and keeps 2 years. Grafana is provisioned read-only from `monitoring/grafana/`: the Prometheus data source, the dashboards in the **Miedăria Păunilor** folder, and alert rules emailed to `GRAFANA_ALERT_EMAIL` at most daily while firing: unresolved delayed payments, background task failures, backend unreachable, and more than 100 failed or throttled customer logins in an hour. Grafana runs under `/grafana/` behind nginx with its own login (sign-up, anonymous access, external snapshots and phoning home disabled; secure `SameSite=Strict` cookies; its own CSP and HSTS), rate-limited by nginx and excluded in `robots.txt`.
*   **Shop** (`dashboards/shop.json`): revenue, paid orders, average order, bottles per order, checkouts and conversion; revenue and checkouts per day, week or month (the Group by variable); products sold; orders by status; stock, bottles held by checkouts and days sold out; unresolved delayed payments; newsletter subscribers; customer accounts; when checkout was on or off; paid orders per delivery method, shipping charged and parcels on their way.
*   **Backend** (`dashboards/backend.json`): up/down, request rate, server errors, background task failures, response time percentiles, metrics scrape time, a per-route table of requests, client and server errors and response time, and hourly customer logins by result.

*   **Traffic** (`dashboards/traffic.json`): visitors, page views and pages per visitor; views per page per day, week or month; where visits come from, language split and blog-to-shop click-through; views, entries and paths between pages; per-product views, cart additions, bottles sold and unmet demand; shop filters used; blog post views; and the newsletter popup's outcomes and sign-up rate.

All three use Bucharest time and link to each other. Every JSON file in `monitoring/grafana/dashboards/` is loaded on startup and reloaded within 10 s of a change; Grafana does not save UI edits to them, so a dashboard is changed by editing its JSON (or by exporting a UI copy with *Export → Export as JSON* into that directory).

Diesel is used to interact with the database, dealing with:
*   Fetching data from the `products`, `images`, and `blog_posts` tables.
*   **Blog Management:**
    *   Provides API endpoints (`/api/blog` GET, `/api/blog/{slug}` GET) for retrieving published blog posts.
    *   Offers admin API endpoints (`/api/admin/blog` POST, `/api/admin/blog/{id}` PUT, `/api/admin/blog/{id}` DELETE, `/api/admin/blog/admin` GET) for full CRUD operations on blog posts.
    *   Validates blog post fields including title, slug format, content, excerpt, and author.
    *   Supports bilingual content with separate fields for English and Romanian versions.
    *   Includes slug validation and duplicate slug prevention.
*   **Image Management:**
    *   Provides an API endpoint (`/api/admin/images` POST) for uploading product images.
    *   Saves uploaded images to a designated directory (`/app/images`) within the Docker container, mounted as a volume. Files are saved as `UUID.lowercase_extension`. Uploads are validated against magic bytes (JPEG, PNG, GIF, WebP, BMP, TIFF) and enforced to a 50 MB size limit before any data is written to disk. File extension is derived from content, not the client-supplied filename.
    *   Stores image metadata (UUID, filename, storage path, creation time, file size) in the `images` table.
    *   Offers API endpoints (`/api/admin/images` GET, `/api/admin/images/{image_id}` GET, `/api/admin/images/{image_id}` PUT, `/api/admin/images/{image_id}` DELETE) for full CRUD operations on image metadata.
    *   **Image Deletion:** Checks for foreign key references in the `products` table before deletion. If an image is still referenced by a product, the deletion is prevented, and a `409 Conflict` status is returned. Gracefully handles cases where an image file is already missing from the filesystem.
    *   **Image Serving:** Provides a public endpoint (`/images/{image_id}` GET) that serves the image file directly, looking up its `storage_path` and `Content-Type` from the `images` table.
    *   **Consistent Database Interaction:** Image CRUD operations accept a mutable pooled database connection (`&mut PgConnection`) as an argument, aligning with product operations for consistent resource management.
*   **Product Management:**
    *   Fetching data from the `products` table, including associated `image` data (`ProductWithImage`).
    *   Modifying, inserting, and deleting entries from the `products` table via authenticated admin endpoints.
    *   Comprehensive validation of product creation and update fields including:
        *   Product ID format (lowercase letters, dashes, underscores) and length (max 128 chars)
        *   Required fields (name, description, ingredients); name fields capped at 256 chars
        *   Numeric validation (ABV range 0.0-99.9, bottle count non-negative, bottle size positive, price validation)
        *   Precision validation (ABV with 1 decimal place, price with 2 decimal places)
        *   Date validation (bottling date cannot be in the future)
        *   Lot number validation (must be positive integer)
    *   Validation uses `ProductValidationInput<'a>` (borrowed string fields, copied scalars) to avoid allocations when validating both new and existing products.
    *   Blog post validation enforces length limits: title/title_ro (512), slug (256), excerpt/excerpt_ro (1024), author (256).
    *   Enum product attributes are validated at the serde deserialization layer (invalid values rejected before handler code runs) and at the PostgreSQL ENUM type level.
    *   Returning specific error types for different validation failures.
    *   **Paginated List Endpoints:** All four list endpoints (`/api/products`, `/api/admin/products`, `/api/blog`, `/api/admin/blog`) return a `PaginatedResponse<T>` struct with `items: Vec<T>` and `total_pages: u64`. The backend runs a separate `COUNT(*)` query (mirroring the same filters) alongside the paginated fetch. The `PaginatedResponse<T: Serialize>` generic struct is defined in `models.rs`.
    *   **Enhanced Product Filtering:** The `/api/products` GET endpoint supports comprehensive filtering by all product attributes including:
        *   `product_type` - Filter by mead type (hidromel, melomel, metheglin, etc.)
        *   `sweetness` - Filter by sweetness level (bone-dry, dry, semi-dry, etc.)
        *   `turbidity` - Filter by clarity level (crystalline, hazy, cloudy)
        *   `effervescence` - Filter by carbonation level (flat, perlant, sparkling)
        *   `acidity` - Filter by acidity level (mild, moderate, strong)
        *   `tannins` - Filter by tannin level (mild, moderate, strong)
        *   `body` - Filter by body/mouthfeel (light, medium, full)
        *   `in_stock` - Filter to show only products with available inventory
        *   `order_by` - Sort by price, volume, or bottling_date
        *   `order_direction` - Sort direction (asc/desc)

## Frontend
### UI/UX
The frontend features a sleek, modern, and reactive user experience. The design is fully responsive, ensuring a great experience on all devices, from mobile phones to desktops.

### Technologies
The frontend is written in `Vite + React + TypeScript`.
*   `react-router-dom` is used for client-side routing.
*   `Nginx` serves the built static assets in the production Docker environment and proxies image requests (`/images/UUID`) to the backend.
*   `React Context` is used for state management, specifically for user authentication (JWTs) and shopping cart functionality. JWTs loaded from `localStorage` are validated for structural format (`header.payload.signature`) before use; malformed values are discarded.
*   `react-i18next` and `i18next` provide internationalization support for multiple languages.

### CSS Architecture
The styling is managed through a modular and organized CSS architecture:
*   **Global Styles (`index.css`):** A global stylesheet defines CSS variables for the color palette, typography (using Google Fonts), and base styles for common HTML elements.
*   **Component-Specific Styles:** Each page and major component has its own dedicated CSS file (e.g., `Home.css`, `Shop.css`, `Admin.css`). This keeps styles organized and easy to maintain.
*   **Responsive Design:** Media queries are used extensively in the CSS files to ensure the layout adapts to different screen sizes. A hamburger menu is implemented for mobile navigation.

### Features
The frontend website is structured as follows:
```
/ -- redirects to home/
    home/ -- A visually appealing landing page with a hero section, featured products (showing the 3 latest in-stock meads by bottling date), latest blog posts, and teasers for other sections. Displays images using UUID-based URLs. After 25 s on the page and 40 % scrolled, once the age gate and cookie banner are answered, a dismissible bottom-corner `NewsletterPopup` (X or Escape) invites sign-up. Closing hides it for 60 days and subscribing hides it for good, remembered by the `newsletter_popup` key in localStorage with cookie consent or sessionStorage without it (`lib/newsletterPopup.ts`).
    shop/ -- Displays all products in a grid, with a comprehensive sidebar for filtering by product attributes (mead type, sweetness, turbidity, effervescence, acidity, tannins, body), sorting (price, volume, or bottling_date), and stock status. Displays images using UUID-based URLs.
        shop/[product_id]/ -- A detailed view of a single product with breadcrumb navigation, an "Add to Cart" button and quantity selector. Displays images using UUID-based URLs.
    blog/ -- Displays blog posts in reverse chronological order with markdown rendering and bilingual support.
        blog/[slug]/ -- A detailed view of a single blog post with breadcrumb navigation and full markdown content.
    cart/ -- A summary of the items in the shopping cart, with options to update quantities, remove items, or clear the cart; the delivery choice (Sameday courier or easybox locker) with its price; the products, shipping and total; and the required 18+ confirmation before checkout.
    about-us/ -- A static page with a modern design telling the story of the meadery.
    contact/ -- A static page with contact information.
    privacy-policy/ -- Bilingual GDPR privacy policy: controller identity, one block per processing activity (`ACTIVITIES` in `PrivacyPolicy.tsx`: orders and delivery, payments, customer accounts, newsletter, contact, site statistics, security logs) with its data, purpose, legal basis and retention, the recipients, EU transfers, data-subject rights and the ANSPDCP complaint route. `ACTIVITIES` and `RECIPIENTS` must be kept in sync with what the code collects and who it shares data with. Linked from the footer, the cookie policy and the newsletter popup, and included in the sitemap. Both policies render inside the shared `LegalPage` frame (title, intro, last-updated date).
    cookie-policy/ -- Bilingual cookie policy listing every cookie and browser-storage key (`STORAGE_ITEMS` in `CookiePolicy.tsx`, which must be kept in sync with the code), its purpose, lifetime and consent level, a note on Stripe's own cookies and Sameday's locker map, and a button that reopens the consent banner. Linked from the consent banner and the footer, and included in the sitemap. The `theme` localStorage key is written only for an explicit light/dark choice.
    newsletter/confirm, newsletter/unsubscribe -- Landing pages of the email links (noindex). Both strip the token from the address bar on load; confirmation POSTs automatically, unsubscription needs one click.
    account/ -- Customer account pages (lazy-loaded, noindex, disallowed in robots.txt), wrapped in `ProtectedAccountRoute`: order history, order detail (`orders/[order_id]`) and `settings` (email, password, log out everywhere, data download, deletion). `AccountProvider` (`context/AccountContext.tsx`) probes `/api/account/me` once per load; the navbar shows "Log in" or "My account", and the cart and checkout-success pages suggest an account without requiring one.
        account/login, account/register, account/forgot-password -- Login (returns to a same-site `next` path only, `lib/accountRedirect.ts`), and the email-only forms that start registration or a reset. Login and register offer "Continue with Google" (`GoogleButton`, a plain link to the start endpoint) when `useSignInProviders` reports it enabled.
        account/set-password, account/email/confirm -- Landing pages of the account emails. The token is stripped from the address bar (`useConsumedParams`); both act only on an explicit submit or click, so link scanners change nothing.
    * -- 404 Not Found page for any unmatched route.
    admin/ -- A login page for administrators.
        admin/dashboard/ -- A protected admin section with a sidebar for navigation. Logout requires confirmation.
            admin/dashboard/products -- A page to manage products (create, edit, delete) with a modern table view. Product forms include image selection from uploaded images.
            admin/dashboard/images -- A page to manage images (upload via click or drag-and-drop with progress bar, display, rename, delete). Displays a user-friendly error message if attempting to delete an image in use.
            admin/dashboard/orders -- Orders with their items, delivery details and Sameday waybill actions (generate, label, cancel).
            admin/dashboard/shipping -- Shipping price, free-shipping threshold and availability per delivery method.
            admin/dashboard/blog -- A page to manage blog posts (create, edit, delete) with markdown editor and bilingual support. Published posts have an "Email subscribers" action (with confirmation showing the recipient count; "Email again" once sent). The dashboard shows the confirmed subscriber count. The dashboard and metrics pages show a `StaleProcessingWarning` listing unresolved delayed payments.
```
All pages are fully implemented and fetch data from the backend where applicable.
The frontend uses two type families: `LocalizedProduct`/`LocalizedProductWithImage`/`LocalizedBlogPost` for public-facing components (single-language fields from Accept-Language negotiation), and `Product`/`ProductWithImage`/`BlogPost`/`ProductFormData` for admin edit forms (full bilingual fields).

### Frontend Architecture Patterns
*   **Custom Hooks:** The `useFetchProducts` hook encapsulates logic for fetching product data with loading and error states, returning `LocalizedProductWithImage[]` along with `totalPages` and `hasMore` from the paginated backend response. The `useFetchEnums` hook fetches enum values from the backend API. The `useLanguage` hook (`hooks/useLanguage.ts`) provides a type-safe `Language` union type (`'en' | 'ro'`) wrapping `i18n.language`. The `useFormattedDate` hook (`hooks/useFormattedDate.ts`) returns a locale-aware date formatting function using the current language.
*   **Reusable Components:** The `ProductCard` component provides a consistent UI structure for displaying individual product cards across different pages with a clean two-line product summary layout (mead type and sweetness on the first line, ABV and volume on the second line with aligned pipe separators). Product images use `loading="lazy"` and `decoding="async"`, with a placeholder shown on load error. The `Breadcrumb` component renders accessible breadcrumb navigation (`aria-label="breadcrumb"`, `aria-current="page"`) and is used on product detail and blog post detail pages. The `Pagination` component shows "Page X of Y" when `totalPages` is provided, and all pagination buttons meet the 44×44px minimum touch target size.
*   **Modular Form Components:** Generic, reusable form input components (`TextInput`, `TextAreaInput`, `NumberInput`, `SelectInput`) centralize input rendering, labeling, and error display logic with support for help text and placeholders.
*   **Environment-Based Configuration:** The frontend uses `import.meta.env.VITE_API_BASE_URL` for API configuration, centralizing settings through environment variables. TypeScript environment type definitions are provided in `src/vite-env.d.ts`.
 *   **Stock Availability Utilities:** The `stockAvailability.ts` module provides utility functions (`getShopStockStatus`, `getProductDetailsStockStatus`, `isInStock`) for consistent stock status display across the application with appropriate CSS classes and descriptions.
  *   **Number Utilities:** The `numberUtils.ts` module provides utility functions (`toFixed`) for formatting decimal values. The `abv` and `price_ron` fields in `Product` and the `price` field in `LocalizedProduct` are `number` (not `number | string`) — the API always returns JSON numbers for these fields.
  *   **Date Utilities:** The `dateUtils.ts` module provides comprehensive date formatting and parsing utilities (`formatDateForDisplay`, `parseDateForBackend`, `isValidDisplayDate`) for converting between backend YYYY-MM-DD format and UI DD/MM/YYYY format with validation.
*   **Enhanced Admin UI:** The admin interface features a modern, intuitive design with:
    *   **Dashboard:** Statistics cards showing product counts, inventory value, and low stock alerts
    *   **Sidebar Navigation:** Visual hierarchy with icons and active state indicators
    *   **Data Tables:** Product tables with image previews, status badges, and clear action buttons
    *   **Image Management:** Grid-based image gallery with drag-and-drop upload and previews
    *   **Form Organization:** Logical section grouping with help text and validation
    *   **Date Input Format:** Admin product forms use DD/MM/YYYY date format with automatic conversion to/from backend YYYY-MM-DD format
    *   **Loading States:** Spinner animations and skeleton states for better UX
    *   **Error Handling:** User-friendly error messages with retry options
    *   **Empty States:** Helpful guidance when no data is available
    *   **Responsive Design:** Mobile-optimized layouts with adaptive navigation
    *   **Simplified Login:** Clean, minimal admin login page with focused authentication interface
 *   **Internationalization (i18n):** The application supports English and Romanian using `react-i18next` with an Accept-Language header pattern:
    *   **Accept-Language Negotiation:** The frontend API client (`api.ts`) sends `Accept-Language` header on every request based on `i18n.language`. The backend returns single-language content (product names, descriptions, ingredients, blog titles/excerpts/content) and the correct price/currency pair. Public components use `LocalizedProduct`/`LocalizedBlogPost` types with no bilingual field selection logic.
    *   **Language Type Safety:** `type Language = 'en' | 'ro'` with `useLanguage()` hook provides type-checked language access. `SUPPORTED_LANGUAGES` and `DEFAULT_LANGUAGE` constants are shared between the hook and i18n config.
    *   **Language Switcher:** UI component in the header for switching between languages with flag emojis (🇬🇧/🇷🇴) and language codes
    *   **Translation Files:** JSON-based translation files for all UI text
    *   **Automatic Detection:** Browser language detection with localStorage persistence
    *   **Comprehensive Coverage:** All UI text translated including navigation, forms, buttons, error messages, and product descriptions
    *   **Translated Enums:** Product attribute enums (mead type, sweetness, turbidity, etc.) are translated via `getEnumLabel()` using translation files
    *   **Admin Forms:** Admin create/edit forms use full bilingual `Product`/`BlogPost` types to edit both language versions simultaneously. Admin product edit fetches from `GET /api/admin/products/{id}` which returns full bilingual data.
*   **Home Page Blog Integration:** The home page features a "Latest Blog Posts" section that displays the three most recent published blog posts in a vertical stack with locale-aware formatted dates, author attribution, and excerpts. The section uses consistent card styling with the featured products section (white background, gray border, hover effects) but arranges posts vertically rather than in a grid. The section includes a "View All Posts" button linking to the full blog page. Blog posts are fetched from the backend API which returns them in reverse chronological order (newest first) with content localized via Accept-Language.

### Shopping Cart
The application includes a fully functional shopping cart system with the following features:
*   **Cart Context:** React Context API manages cart state across the application
*   **Cart Operations:** Add items, remove items, update quantities, clear cart
*   **Cart Persistence:** Cart state is maintained during user session
*   **Cart Display:** Cart page shows items with quantity controls, subtotals, and order summary
*   **Cart Badge:** Navigation displays current item count
*   **Stock Validation:** Prevents ordering more bottles than available stock with visual feedback and disabled controls
*   **Quantity Controls:** Plus/minus buttons with light gray symbols on white background that change to white symbols on dark blue background when hovered
*   **Max Quantity Feedback:** Clear messages indicate when maximum available quantity is reached
*   **Delivery:** see Delivery (Sameday)

### SEO and Search Engine Optimization
The application includes SEO-friendly features:
*   **robots.txt:** Located at `/robots.txt`, guides search engine crawlers on which pages to index and which to avoid (admin area, API endpoints)
*   **Dynamic Sitemap:** Located at `/sitemap.xml`, provides search engines with a comprehensive list of all pages including:
    *   Static pages (home, shop, blog, about-us, contact, cookie-policy, privacy-policy)
    *   All product pages (`/shop/{product_id}`)
    *   All published blog posts (`/blog/{slug}`)
    *   Each URL includes metadata about update frequency and priority
*   **Sitemap API Endpoint:** The backend provides `/api/sitemap-data` GET endpoint that returns structured data for sitemap generation
*   **Automated Sitemap Generation:** A cron job runs every 10 minutes to regenerate the sitemap with current product and blog post data
*   **Static File Serving:** Both files are served directly by Nginx from the public directory and are included in the production build

### Sitemap Generation System
The application includes a simplified sitemap generation system:
*   **Backend Support:** New `sitemap_crud.rs` module with `get_sitemap_data()` function that fetches all products and published blog posts
*   **Frontend Integration:** The frontend Docker container includes:
    *   Cron daemon running in background
    *   `curl` and `jq` dependencies installed
    *   Simple `generate-sitemap.sh` script that fetches data from backend and generates sitemap.xml
    *   Cron job configured to run every 10 minutes
*   **Automatic Updates:** Sitemap is automatically regenerated every 10 minutes with current product and blog post data
*   **Direct Serving:** Generated sitemap.xml is placed directly in the nginx web root (`/usr/share/nginx/html/`) for immediate serving

### UI Design
*   The main sticky navigation bar does not include an "Admin" link for regular users, keeping the admin interface separate from the public-facing site.
*   **Improved Button Contrast:** "Clear All Filters" button features dark gray text on light gray background (unhovered) and white text on dark blue background (hovered) for optimal readability
*   **Consistent Interactive Elements:** All quantity control buttons (+/-) use consistent styling with light gray symbols on white background (unhovered) and white symbols on dark blue background (hovered)
