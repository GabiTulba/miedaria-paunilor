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
* a frontend image -- built with React
* a backend image -- build with Rust
* a database image -- build with PostgreSQL


## Networks
The backend is the middle-man between the frontend and the database. For security reasons, the frontend is not on the same docker network as the database and the networks are:
* react-rust -- the frontend and the backend images share this network
* rust-postgres -- the backend and the database images share this network

## Volumes
There are two volumes:
*   **postgres-data:** A volume for the PostgreSQL database.
*   **miedaria_paunilor_images:** A volume for storing uploaded product images, mounted at `/app/images` in both the backend and frontend (Nginx) containers.

## Environment
All Docker images utilize environment variables defined in a single `.env` file located at the project root. This centralizes configuration for all services.

## Environment
All Docker images utilize environment variables defined in a single `.env` file located at the project root. This centralizes configuration for all services. The project includes an `env.sample` file that serves as a template with all required environment variables and their default values.

### Environment Variables

The following environment variables *must* be defined in the `.env` file for the application to run:

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

*   **Backend Configuration:**
    *   `BACKEND_PORT`: The port on which the Rust backend server will listen (default: `8000`)
    *   `IMAGE_UPLOAD_DIR`: The directory where product images will be stored on the filesystem within the Docker container (default: `/app/images`)

*   **Frontend Configuration:**
    *   `VITE_API_BASE_URL`: The base URL for the backend API that the frontend will make requests to (default: `http://localhost:8000/api`)

**Setup Instructions:** To configure the application, copy `env.sample` to `.env` and update the values as needed for your environment. The `.env` file is excluded from version control via `.gitignore` to prevent sensitive information from being committed.

# Logical Components
## Database
### Technologies
This is a PostgreSQL database.

### Features
The instance has a single database [miedaria_paunilor], with four tables:
1. [products]
2. [users]
3. [admin_users]
4. [images]

[images] has the following schema:
* id - (Primary Key) A UUID generated by the database.
* file_name - The original name of the uploaded file.
* storage_path - The path where the file is stored on the filesystem (e.g., /app/images/UUID.ext).
* created_at - Timestamp of when the image was uploaded.
* file_size - Size of the file in bytes.

[products] has the following schema:
* product_id - (Primary Key) A short string composed of lowercase letters, dashes or underscores. Represents the machine-friendly name of the product.
* product_name - A short string that supports any character. Represents the human-friendly name of the product
* product_description - A long, free-form text string. Represents a detailed description of the product.
* ingredients - A text field for the ingredients of the product.
* product_type - String representing the type of mead (e.g., hidromel, melomel, metheglin, etc.)
* sweetness - String representing sweetness level (e.g., bone-dry, dry, semi-dry, etc.)
* turbidity - String representing clarity level (e.g., crystalline, hazy, cloudy)
* effervescence - String representing carbonation level (e.g., flat, perlant, sparkling)
* acidity - String representing acidity level (e.g., mild, moderate, strong)
* tanins - String representing tannin level (e.g., mild, moderate)
* body - String representing body/mouthfeel (e.g., light, medium, full)
* abv - Decimal with one digit of precision, valid ranges from 0.0 to 99.9. Represents the alcohol by volume concentration of the mead.
* bottle_count - Non-negative integer. Represents the number of bottles in stock.
* bottle_size - Positive integer (mililiters of volume). Represents the net volume of the bottle of mead.
* price - Decimal with two digits of precision. Represents the price of the product in Euros.
* image_id - (Foreign Key) A UUID referencing the `id` from the `images` table.

[users] and [admin_users] have the following schema:
* username - (Primary Key) ASCII printable string, limited to 256 characters.
* salt - ASCII printable string, limited to 256 characters.
* hashed_password - Hexadecimal string, limited to 256 characters.

The password is stored in the database as the sha256 hash of the password and the user's salt like the following pseudocode (| means string concatenation):
```
password_hash = hex(sha256(user_salt | password))
```

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
*   [diesel-derive-enum] (v2.1.0) - For enum support in Diesel ORM.

The backend is structured as a library crate (`lib.rs`) consumed by a main binary (`main.rs`) and a helper binary (`add_admin_user.rs`). Key modules include `auth`, `db`, `enum_crud`, `enums`, `error`, `image_crud`, `models`, `product_crud`, `schema`, `user_crud`, and `utils`.

### Enums and Product Attributes
The backend defines comprehensive enums for product attributes in `enums.rs`:
*   **MeadType:** Hidromel, Melomel, Metheglin, Bochet, Braggot, Pyment, Cyser, Rhodomel, Capsicumel, Acerglyn
*   **SweetnessType:** BoneDry, Dry, SemiDry, SemiSweet, Sweet, Dessert
*   **TurbidityType:** Crystalline, Hazy, Cloudy
*   **EffervescenceType:** Flat, Perlant, Sparkling
*   **AcidityType:** Mild, Moderate, Strong
*   **TaninsType:** Mild, Moderate
*   **BodyType:** Light, Medium, Full

**Enum API Endpoint:** The backend provides a `/api/enums` GET endpoint that returns all enum values with their string representations and display labels. This eliminates duplication between frontend and backend.

**Frontend Enum Integration:** The frontend uses the `useFetchEnums` hook to fetch enum values from the backend. Form components like `ProductForm` use these dynamically fetched values for select options, while display components use the `formatEnumLabel` and `getEnumLabel` utility functions from `enums.ts` for consistent label formatting.

### Features
Axum is used to interact with the frontend, dealing with:
*   User requests to various API endpoints (e.g., `/api/products`, `/api/admin/login`, `/api/enums`).
*   Routing, including dynamic path parameters (e.g., `/api/products/{product_id}`, `/images/{image_id}`).
*   User authentication and authorization using JWTs, with an `Auth` extractor (`auth.rs`) to protect admin routes.
*   CORS (Cross-Origin Resource Sharing) middleware is enabled and configured to allow communication with the frontend during development, applied specifically to admin routes to ensure proper preflight handling.
*   **Unified Error Handling:** The `AppError` enum serves as a unified error type for all API handlers, providing `From` implementations for various specific errors (e.g., `diesel::result::Error`, product CRUD errors, authentication errors) and an `IntoResponse` implementation for consistent HTTP response generation.
*   **Centralized Database Connection Acquisition:** The `db::get_db_connection` helper function centralizes the logic for acquiring a database connection from the application's connection pool, reducing boilerplate code in handler functions.

Diesel is used to interact with the database, dealing with:
*   Fetching data from the `products` and `images` tables.
*   **Image Management:**
    *   Provides an API endpoint (`/api/admin/images` POST) for uploading product images.
    *   Saves uploaded images to a designated directory (`/app/images`) within the Docker container, mounted as a volume. Files are saved as `UUID.lowercase_extension`.
    *   Stores image metadata (UUID, filename, storage path, creation time, file size) in the `images` table.
    *   Offers API endpoints (`/api/admin/images` GET, `/api/admin/images/{image_id}` GET, `/api/admin/images/{image_id}` PUT, `/api/admin/images/{image_id}` DELETE) for full CRUD operations on image metadata.
    *   **Image Deletion:** Checks for foreign key references in the `products` table before deletion. If an image is still referenced by a product, the deletion is prevented, and a `409 Conflict` status is returned. Gracefully handles cases where an image file is already missing from the filesystem.
    *   **Image Serving:** Provides a public endpoint (`/images/{image_id}` GET) that serves the image file directly, looking up its `storage_path` and `Content-Type` from the `images` table.
    *   **Consistent Database Interaction:** Image CRUD operations accept a mutable pooled database connection (`&mut PgConnection`) as an argument, aligning with product operations for consistent resource management.
*   **Product Management:**
    *   Fetching data from the `products` table, including associated `image` data (`ProductWithImage`).
    *   Modifying, inserting, and deleting entries from the `products` table via authenticated admin endpoints.
    *   Comprehensive validation of product creation and update fields including:
        *   Product ID format (lowercase letters, dashes, underscores)
        *   Required fields (name, description, ingredients)
        *   Enum validation for product attributes (mead type, sweetness, turbidity, effervescence, acidity, tannins, body)
        *   Numeric validation (ABV range 0.0-99.9, bottle count non-negative, bottle size positive, price validation)
        *   Precision validation (ABV with 1 decimal place, price with 2 decimal places)
    *   Returning specific error types for different validation failures.

## Frontend
### UI/UX
The frontend features a sleek, modern, and reactive user experience. The design is fully responsive, ensuring a great experience on all devices, from mobile phones to desktops.

### Technologies
The frontend is written in `Vite + React + TypeScript`.
*   `react-router-dom` is used for client-side routing.
*   `Nginx` serves the built static assets in the production Docker environment and proxies image requests (`/images/UUID`) to the backend.
*   `React Context` is used for state management, specifically for user authentication (JWTs) and shopping cart functionality.
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
    home/ -- A visually appealing landing page with a hero section, featured products, and teasers for other sections. Displays images using UUID-based URLs.
    shop/ -- Displays all products in a grid, with a sidebar for filtering and sorting. Displays images using UUID-based URLs.
        shop/[product_id]/ -- A detailed view of a single product with an "Add to Cart" button and quantity selector. Displays images using UUID-based URLs.
    cart/ -- A summary of the items in the shopping cart, with options to update quantities, remove items, or clear the cart.
    about-us/ -- A static page with a modern design telling the story of the meadery.
    contact/ -- A static page with contact information.
    admin/ -- A login page for administrators.
        admin/dashboard/ -- A protected admin section with a sidebar for navigation.
            admin/dashboard/products -- A page to manage products (create, edit, delete) with a modern table view. Product forms include image selection from uploaded images.
            admin/dashboard/images -- A page to manage images (upload, display, rename, delete). Displays a user-friendly error message if attempting to delete an image in use.
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
*   **Enhanced Admin UI:** The admin interface features a modern, intuitive design with:
    *   **Dashboard:** Statistics cards showing product counts, inventory value, and low stock alerts
    *   **Sidebar Navigation:** Visual hierarchy with icons and active state indicators
    *   **Data Tables:** Product tables with image previews, status badges, and clear action buttons
    *   **Image Management:** Grid-based image gallery with drag-and-drop upload and previews
    *   **Form Organization:** Logical section grouping with help text and validation
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

### Shopping Cart
The application includes a fully functional shopping cart system with the following features:
*   **Cart Context:** React Context API manages cart state across the application
*   **Cart Operations:** Add items, remove items, update quantities, clear cart
*   **Cart Persistence:** Cart state is maintained during user session
*   **Cart Display:** Cart page shows items with quantity controls, subtotals, and order summary
*   **Cart Badge:** Navigation displays current item count

### UI Design
*   The main sticky navigation bar does not include an "Admin" link for regular users, keeping the admin interface separate from the public-facing site.
