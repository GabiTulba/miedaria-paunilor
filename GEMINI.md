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
Whenever you do significant feature or behaviour changes to the codebase, remember to update this GEMINI.md document. Your updates should be concise, summaries of the changes and always consider the rest of the information already present in this document, trying to keep the size of this document relatively small over time.


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
There is only one volume for the PostgreSQL database.
*   **images:** A volume for storing uploaded product images, mounted at `/app/images` in the backend container.

## Environment
All Docker images utilize environment variables defined in a single `.env` file located at the project root. This centralizes configuration for all services.

# Logical Components
## Database
### Technologies
This is a PostgreSQL database.

### Features
The instance has a single database [miedaria_paunilor], with three tables:
1. [products]
2. [users]
3. [admin_users]

[products] has the following schema:
* product_id - (Primary Key) A short string composed of lowercase letters, dashes or underscores. Represents the machine-friendly name of the product.
* product_name - A short string that supports any character. Represents the human-friendly name of the product
* product_description - A long, free-form text string. Represents a detailed description of the product.
* ingredients - A text field for the ingredients of the product.
* abv - Decimal with one digit of precision, valid ranges from 0.0 to 99.9. Represents the alcohol by volume concentration of the mead.
* bottle_count - Non-negative integer. Represents the number of bottles in stock.
* bottle_size - Positive integer (mililiters of volume). Represents the net volume of the bottle of mead.
* price - Decimal with two digits of precision. Represents the price of the product in Euros.
* image_url - A string representing the URL of the product image.

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
*   [diesel] (v2.2.0) - An ORM and query builder for database interactions, with the `r2d2` feature enabled.
*   [jsonwebtoken] (v10.2.0) - For JWT (JSON Web Token) signing and verification, with the `rust_crypto` feature enabled.
*   [tokio] (v1) - An asynchronous runtime for Rust.
*   [r2d2] (v0.8.10) - A connection pool for managing database connections.
*   [async-trait] (v0.1.80) - A procedural macro for async functions in traits.

The backend is structured as a library crate (`lib.rs`) consumed by a main binary (`main.rs`) and a helper binary (`add_admin_user.rs`).

### Features
Axum is used to interact with the frontend, dealing with:
*   User requests to various API endpoints (e.g., `/api/products`, `/api/admin/login`).
*   Routing, including dynamic path parameters (e.g., `/api/products/{product_id}`).
*   User authentication and authorization using JWTs, with an `Auth` extractor (`auth.rs`) to protect admin routes.
*   CORS (Cross-Origin Resource Sharing) middleware is enabled to allow communication with the frontend during development.

Diesel is used to interact with the database, dealing with:
*   Fetching data from the `products` table.
*   Modifying, inserting, and deleting entries from the `products` table via authenticated admin endpoints.
*   User management (fetching admin/regular users, creating, updating passwords, deleting) for authentication purposes.
*   Validation of product creation and update fields to ensure data integrity and security, returning specific error types for different validation failures.
*   **Image Upload:**
    *   Provides an API endpoint (`/api/images/upload`) for uploading product images.
    *   Saves uploaded images to a designated directory (`/app/images`) within the Docker container, intended to be mounted as a volume.
    *   Performs basic validation to ensure only image files are uploaded.
    *   Returns the URL of the uploaded image for storage in the product's `image_url` field.


## Frontend
### UI/UX
The frontend features a sleek, modern, and reactive user experience. The design is fully responsive, ensuring a great experience on all devices, from mobile phones to desktops.

### Technologies
The frontend is written in `Vite + React + TypeScript`.
*   `react-router-dom` is used for client-side routing.
*   `Nginx` serves the built static assets in the production Docker environment.
*   `React Context` is used for state management, specifically for user authentication (JWTs) and shopping cart functionality.

### CSS Architecture
The styling is managed through a modular and organized CSS architecture:
*   **Global Styles (`index.css`):** A global stylesheet defines CSS variables for the color palette, typography (using Google Fonts), and base styles for common HTML elements.
*   **Component-Specific Styles:** Each page and major component has its own dedicated CSS file (e.g., `Home.css`, `Shop.css`, `Admin.css`). This keeps styles organized and easy to maintain.
*   **Responsive Design:** Media queries are used extensively in the CSS files to ensure the layout adapts to different screen sizes. A hamburger menu is implemented for mobile navigation.

### Features
The frontend website is structured as follows:
```
/ -- redirects to home/
    home/ -- A visually appealing landing page with a hero section, featured products, and teasers for other sections.
    shop/ -- Displays all products in a grid, with a sidebar for filtering and sorting.
        shop/[product_id]/ -- A detailed view of a single product with an "Add to Cart" button and quantity selector.
    cart/ -- A summary of the items in the shopping cart, with options to update quantities, remove items, or clear the cart.
    about-us/ -- A static page with a modern design telling the story of the meadery.
    contact/ -- A static page with contact information and a contact form.
    admin/ -- A login page for administrators.
        admin/dashboard/ -- A protected admin section with a sidebar for navigation.
            admin/dashboard/products -- A page to manage products (create, edit, delete) with a modern table view.
```
All pages are fully implemented with the new design and fetch data from the backend where applicable.