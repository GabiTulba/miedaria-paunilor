# Notes for AI Agents
## Scope
This documents serves as high-level documentation for an app, describing the architecture, components, technologies, and features of the app.


## Coding Style and Code Quality
You write your code in a concise, easily readable way, only leaving inline doc-comments where to add additional behaviour information to the reader. The code should be mostly self-documenting. 

You try to avoid code duplication and prefer to factor out similar functionality in separate functions.

You do not want to go into any technical debt. Always implement features with a lot of carefulness, not leaving any feature partially implemented or comments about issues that should be implemented in the future.

You are concerned with security and possible vulnerabilities that the app could have, you try to reason about any form of malicious attack and try to avoid and mitigate them preemptively.

You should feel free to use the latest versions of docker images and programming languages.

## Updating the Documentation
Whenever you do significant feature or behaivour changes to the codebase, remember to update this GEMINI.md document. Your updates should be concise, summaries of the changes and always consider the rest of the information already present in this document, trying to keep the size of this document relatively small over time.


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

## Environment
All Docker images utilize environment variables defined in a single `.env` file located at the project root. This centralizes configuration for all services.

# Logical Components
## Database
### Technologies
This is a PostgreSQL database.

### Features
The instance has a single database [miedaria_paunilor], with two tables:
1. [products]
2. [users]

[products] has the following schema:
* product_id - a short string composed of lowercase letters, dashes or underscores. Represents the machine-friendly name of the product.
* name - a short string that supports any character. Represents the human-friendly name of the product
* bottle_size - positive integer (mililiters of volume). Represents the net volume of the bottle of mead.
* bottle_count - non-negative integer. Represents the number of bottles in stock.
* description - a long, free-form text string. Represents a detailed description of the product.
* price_eur - decimal with two digits of precision. Represents the price of the product in Euros.
* abv - decimal with one digit of precision, valid ranges from 0.0 to 99.9. Represents the alcohol by volume concentration of the mead.

[users] has the following schema:
* unique identifier - integer, auto increasing
* user_name - ASCII printable string, limited to 256 characters.
* user_salt - ASCII printable string, limited to 256 characters.
* password_hash - hexadecimal string, limited to 256 characters.

The password is stored in the database as the sha256 hash of the password and the user's salt like the following pseudocode (| means string concatenation):
```
password_hash = hex(sha256(user_salt | password))
```

The [users] database is initialized at container startup by the backend's `entrypoint.sh` using `diesel setup` (to create the database and run migrations) and then `add_admin_user` to create the default admin user with credentials from the root `.env` file.

## Backend
### Technologies
The backend acts as a middle-man between the frontend and the database. It is built with Rust and utilizes the following key libraries:
*   [axum] - A web application framework for handling user requests, routing, and API endpoints. (Updated to 0.8.x)
*   [diesel] - An ORM and query builder for database interactions. (Updated version, with `r2d2` feature enabled)
*   [jsonwebtoken] - For JWT (JSON Web Token) signing and verification. (Updated version, with `rust_crypto` feature enabled)
*   [tokio] - An asynchronous runtime for Rust.
*   [r2d2] - A connection pool for managing database connections.
*   [async-trait] - A procedural macro for async functions in traits.

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


## Frontend
### Technologies
The frontend is written in `Vite + React + TypeScript`, offering a sleek and modern UI with low overhead and intuitive UX.
*   `react-router-dom` is used for client-side routing.
*   `Nginx` serves the built static assets in the production Docker environment.
*   `React Context` is used for state management, specifically for user authentication (JWTs) and shopping cart functionality.
*   Global CSS (`index.css`) provides basic styling and a consistent visual theme.

### Features
The frontend website is structured as follows:
```
/ -- redirects to home/
    home/ -- entry page, displays contents of shop/ about-us/ contact/ in a summarised way.
    shop/ -- displays all the products in the shop, only displays a summary view of each product
        shop/[product_id]/ -- displays all the details about the product, with an "Add to Cart" button.
    cart/ -- displays all the products in the cart, alongside their total price, with options to remove items or clear the cart.
    about-us/ -- displays a static page that has a short story about the owners
    contact/ -- displays a static page that has a short list of contact details: mail, phone number, address
    admin/ -- login page for admin users, after login, it always redirects to admin/dashboard/
        admin/dashboard/ -- admin dashboard, showing a list of all the other admin pages. These routes are protected by JWT authentication.
            admin/dashboard/products -- displays all the products in the database for administration, with the possibility of adding new products, deleting old ones, and editing existing ones.
            admin/dashboard/products/[product_id]/edit -- displays a page that allows to edit product data. The admin user gets redirected here after clicking on an edit button on a specific product.
            admin/dashboard/products/create/ -- page to create a new product entry in the database. The admin user gets redirected to this page when they click on a button to create a new product on admin/dashboard/products/
```
All frontend pages are now implemented with placeholder content and fetch data from the backend where applicable.