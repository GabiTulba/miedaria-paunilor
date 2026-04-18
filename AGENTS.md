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


## Networks
The backend is the middle-man between the frontend and the database. For security reasons, the frontend is not on the same docker network as the database and the networks are:
* react-rust -- the frontend and the backend images share this network
* rust-postgres -- the backend and the database images share this network

## Volumes
There are two volumes:
*   **postgres-data:** A volume for the PostgreSQL database.
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

*   **Frontend Configuration:**
    *   `VITE_API_BASE_URL`: The base URL for the backend API that the frontend will make requests to (default: `/api`)

**Setup Instructions:** Copy `env.sample` to `.env` and update values for your environment. The `.env` file is excluded from version control. **All default secrets (`POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `JWT_SECRET`) must be changed before any production deployment.**

### Security Hardening
*   **No exposed ports for database or backend** — only the frontend exposes ports 80 and 443 to the host. The backend (port 8000) and database (port 5432) are accessible only via internal Docker networks.
*   **Non-root containers** — the backend runs as `appuser` (via `gosu` in `entrypoint.sh`); the frontend runs as the `nginx` user.
*   **Resource limits and healthchecks** configured on all services in `docker-compose.yml`.
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
The instance has a single database [miedaria_paunilor], with five tables:
1. [products]
2. [users]
3. [admin_users]
4. [images]
5. [blog_posts]

[images] has the following schema:
* id - (Primary Key) A UUID generated by the database.
* file_name - The original name of the uploaded file. `VARCHAR(512)`.
* storage_path - The path where the file is stored on the filesystem (e.g., /app/images/UUID.ext). `VARCHAR(1024)`.
* created_at - Timestamp of when the image was uploaded.
* file_size - Size of the file in bytes.

[blog_posts] has the following schema:
* id - (Primary Key) A UUID generated by the database.
* title - The title of the blog post in English.
* title_ro - The title of the blog post in Romanian.
* slug - URL-friendly identifier (lowercase letters, numbers, hyphens only).
* content_markdown - The blog post content in Markdown format (English).
* content_markdown_ro - The blog post content in Markdown format (Romanian).
* excerpt - Short summary for blog listing (English).
* excerpt_ro - Short summary for blog listing (Romanian).
* author - Author name.
* published_at - Timestamp of when the blog post was published.
* updated_at - Timestamp of when the blog post was last updated.
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
* tanins - PostgreSQL ENUM (`tanins_type_enum`): mild, moderate, strong
* body - PostgreSQL ENUM (`body_type_enum`): light, medium, full
* abv - Decimal with one digit of precision, valid ranges from 0.0 to 99.9. Represents the alcohol by volume concentration of the mead.
* bottle_count - Non-negative integer. Represents the number of bottles in stock.
* bottle_size - Positive integer (mililiters of volume). Represents the net volume of the bottle of mead.
 * price - Decimal with two digits of precision. Represents the price of the product in Euros.
 * price_ron - Decimal with two digits of precision. Represents the price of the product in Romanian Lei.
 * image_id - (Foreign Key) A UUID referencing the `id` from the `images` table.
 * bottling_date - Date when the mead was bottled. Required field with validation (cannot be in the future).
 * lot_number - Production lot number as a positive integer. Required field with validation (must be > 0).

[users] and [admin_users] have the following schema:
* username - (Primary Key) `VARCHAR(256)`.
* hashed_password - Argon2id PHC string (includes embedded salt, algorithm parameters, and hash). `VARCHAR(512)`.

Passwords are hashed with Argon2id via the `argon2` crate. The PHC string format embeds the salt and parameters, so no separate salt column is needed.

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

The backend is structured as a library crate (`lib.rs`) consumed by a main binary (`main.rs`) and a helper binary (`add_admin_user.rs`). Key modules include `auth`, `blog_crud`, `db`, `enum_crud`, `enums`, `error`, `image_crud`, `models`, `product_crud`, `schema`, `sitemap_crud`, `user_crud`, and `utils`.

`AppState` holds the database connection pool, login rate limiter, and `site_url` (read from `ALLOWED_ORIGIN` env var) used by `sitemap_crud` to construct absolute URLs.

### Enums and Product Attributes
Product attribute enums are defined in `enums.rs` as Rust enums backed by PostgreSQL ENUM types. Each enum derives `diesel_derive_enum::DbEnum` for DB mapping, `serde` with `rename_all = "kebab-case"` for API serialization, and uses `#[DbValueStyle = "kebab-case"]` for DB value mapping. The Rust types, PostgreSQL types, and JSON API all use the same kebab-case string values (e.g., `"bone-dry"`, `"semi-sweet"`).

*   **MeadType** (`mead_type_enum`): Hidromel, Melomel, Metheglin, Bochet, Braggot, Pyment, Cyser, Rhodomel, Capsicumel, Acerglyn
*   **SweetnessType** (`sweetness_type_enum`): BoneDry, Dry, SemiDry, SemiSweet, Sweet, Dessert
*   **TurbidityType** (`turbidity_type_enum`): Crystalline, Hazy, Cloudy
*   **EffervescenceType** (`effervescence_type_enum`): Flat, Perlant, Sparkling
*   **AcidityType** (`acidity_type_enum`): Mild, Moderate, Strong
*   **TaninsType** (`tanins_type_enum`): Mild, Moderate, Strong
*   **BodyType** (`body_type_enum`): Light, Medium, Full

Enum validation is handled at two levels: serde rejects invalid values during JSON/query parameter deserialization (before any handler code runs), and PostgreSQL ENUM types reject invalid values at the database level. No manual enum validation exists in application code.

**Enum API Endpoint:** The backend provides a `/api/enums` GET endpoint that returns all enum values with their string representations and bilingual display labels (English and Romanian). String values are derived from serde serialization of each enum variant. This eliminates duplication between frontend and backend.

**Frontend Enum Integration:** The frontend uses the `useFetchEnums` hook to fetch enum values from the backend. Form components like `ProductForm` use these dynamically fetched values for select options, while display components use the `getEnumLabel` utility function from `enums.ts` with language support for consistent label formatting across both languages.

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
    *   Blog post validation enforces length limits: title/title_ro (512), blog_id (256), excerpt/excerpt_ro (1024), author (256).
    *   Enum product attributes are validated at the serde deserialization layer (invalid values rejected before handler code runs) and at the PostgreSQL ENUM type level.
    *   Returning specific error types for different validation failures.
    *   **Enhanced Product Filtering:** The `/api/products` GET endpoint supports comprehensive filtering by all product attributes including:
        *   `product_type` - Filter by mead type (hidromel, melomel, metheglin, etc.)
        *   `sweetness` - Filter by sweetness level (bone-dry, dry, semi-dry, etc.)
        *   `turbidity` - Filter by clarity level (crystalline, hazy, cloudy)
        *   `effervescence` - Filter by carbonation level (flat, perlant, sparkling)
        *   `acidity` - Filter by acidity level (mild, moderate, strong)
        *   `tanins` - Filter by tannin level (mild, moderate, strong)
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
    home/ -- A visually appealing landing page with a hero section, featured products (showing the 3 latest in-stock meads by bottling date), latest blog posts, and teasers for other sections. Displays images using UUID-based URLs.
    shop/ -- Displays all products in a grid, with a comprehensive sidebar for filtering by product attributes (mead type, sweetness, turbidity, effervescence, acidity, tannins, body), sorting (price, volume, or bottling_date), and stock status. Displays images using UUID-based URLs.
        shop/[product_id]/ -- A detailed view of a single product with an "Add to Cart" button and quantity selector. Displays images using UUID-based URLs.
    blog/ -- Displays blog posts in reverse chronological order with markdown rendering and bilingual support.
        blog/[slug]/ -- A detailed view of a single blog post with full markdown content.
    cart/ -- A summary of the items in the shopping cart, with options to update quantities, remove items, or clear the cart. Includes a warning message indicating the checkout system is under development and instructing users to send orders via WhatsApp.
    about-us/ -- A static page with a modern design telling the story of the meadery.
    contact/ -- A static page with contact information.
    admin/ -- A login page for administrators.
        admin/dashboard/ -- A protected admin section with a sidebar for navigation.
            admin/dashboard/products -- A page to manage products (create, edit, delete) with a modern table view. Product forms include image selection from uploaded images.
            admin/dashboard/images -- A page to manage images (upload, display, rename, delete). Displays a user-friendly error message if attempting to delete an image in use.
            admin/dashboard/blog -- A page to manage blog posts (create, edit, delete) with markdown editor and bilingual support.
```
All pages are fully implemented and fetch data from the backend where applicable.
The frontend `Product` and `ProductWithImage` types include all product attributes and image management.

### Frontend Architecture Patterns
*   **Custom Hooks:** The `useFetchProducts` hook encapsulates logic for fetching product data with loading and error states, reducing code duplication in components that display product listings. The `useFetchEnums` hook fetches enum values from the backend API.
*   **Reusable Components:** The `ProductCard` component provides a consistent UI structure for displaying individual product cards across different pages with a clean two-line product summary layout (mead type and sweetness on the first line, ABV and volume on the second line with aligned pipe separators).
*   **Modular Form Components:** Generic, reusable form input components (`TextInput`, `TextAreaInput`, `NumberInput`, `SelectInput`) centralize input rendering, labeling, and error display logic with support for help text and placeholders.
*   **Environment-Based Configuration:** The frontend uses `import.meta.env.VITE_API_BASE_URL` for API configuration, centralizing settings through environment variables. TypeScript environment type definitions are provided in `src/vite-env.d.ts`.
 *   **Stock Availability Utilities:** The `stockAvailability.ts` module provides utility functions (`getShopStockStatus`, `getProductDetailsStockStatus`, `isInStock`) for consistent stock status display across the application with appropriate CSS classes and descriptions.
  *   **Number Utilities:** The `numberUtils.ts` module provides utility functions (`toNumber`, `toFixed`) for safely converting between string and number representations of decimal values, ensuring consistent handling of product prices and ABV values across the application.
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
 *   **Internationalization (i18n):** The application supports multiple languages (English and Romanian) using `react-i18next` with:
    *   **Language Switcher:** UI component in the header for switching between languages with flag emojis (🇬🇧/🇷🇴) and language codes
    *   **Translation Files:** JSON-based translation files for all UI text
    *   **Automatic Detection:** Browser language detection with localStorage persistence
    *   **Comprehensive Coverage:** All UI text translated including navigation, forms, buttons, error messages, and product descriptions
    *   **Bilingual Product Data:** Product names, descriptions, and ingredients are stored in both English and Romanian, with automatic language switching based on user preference
    *   **Dual Currency Support:** Product prices displayed in both Euros and Romanian Lei based on user language preference
    *   **Translated Enums:** Product attribute enums (mead type, sweetness, turbidity, etc.) are translated automatically based on user language
*   **Home Page Blog Integration:** The home page features a "Latest Blog Posts" section that displays the three most recent published blog posts in a vertical stack with bilingual support, formatted dates, author attribution, and excerpts. The section uses consistent card styling with the featured products section (white background, gray border, hover effects) but arranges posts vertically rather than in a grid. The section includes a "View All Posts" button linking to the full blog page. Blog posts are fetched from the backend API which returns them in reverse chronological order (newest first), ensuring the home page always shows the most recent content.

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
*   **Development Warning:** The cart page displays a prominent warning message indicating that the checkout system is under development and instructing users to send their orders via WhatsApp until the checkout system is ready

### SEO and Search Engine Optimization
The application includes SEO-friendly features:
*   **robots.txt:** Located at `/robots.txt`, guides search engine crawlers on which pages to index and which to avoid (admin area, API endpoints)
*   **Dynamic Sitemap:** Located at `/sitemap.xml`, provides search engines with a comprehensive list of all pages including:
    *   Static pages (home, shop, blog, about-us, contact, cart)
    *   All product pages (`/shop/{product_id}`)
    *   All published blog posts (`/blog/{blog_id}`)
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
