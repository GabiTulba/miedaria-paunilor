# Miedaria Paunilor E-commerce Project

This document provides a high-level overview of the Miedaria Paunilor project, an e-commerce platform for selling mead.

## Project Description

Miedaria Paunilor is a web application built with Next.js, React, and Tailwind CSS. The primary goal of this project is to provide a seamless and visually appealing online shopping experience for customers interested in purchasing mead.

### Key Technologies

*   **Framework:** Next.js
*   **UI Library:** React
*   **Styling:** Tailwind CSS
*   **Database:** MySQL
*   **Authentication:** JSON Web Tokens (JWT) using `jose` library (Edge Runtime compatible)

### Current State

The project is currently in an early prototype stage. The main features include:

*   A homepage that showcases a selection of products.
*   A dedicated shop page that displays all available products.
*   A product detail page for each product.
*   A MySQL database to store and manage products and users.
*   A simple admin panel at `/admin/login` to manage products, now with enhanced authentication and navigation:
    *   Requests to `/admin` are redirected to `/admin/login` if the user is not authenticated.
    *   The `/admin` page provides a menu to disconnect, navigate to the product dashboard, and displays the logged-in user's username.
    *   Login and logout functionalities are fully integrated with cookie-based authentication.

Product data is now managed through the admin panel and stored in the MySQL database.
*   **Product Management:** The `/admin/products` page allows administrators to add, edit, and delete products. Product deletion includes a confirmation step and interacts with the `/api/admin/products/[product_name]` endpoint.
*   **Admin User Display:** The `/admin` page displays the actual logged-in username by decoding a JWT stored in an `admin-token` cookie.
*   **Secure Admin Route Protection:** The `middleware.ts` actively verifies the validity of the `admin-token` JWT for all `/admin` routes (excluding login). If the token is invalid, missing, or tampered with, the user is redirected to the `/admin/login` page, ensuring robust and secure access control to administrative areas. The application strictly enforces the presence of the `JWT_SECRET` environment variable at runtime for all JWT operations. All JWT operations now utilize the `jose` library, ensuring compatibility with Next.js Edge Runtime.

## Agent Instructions

### Initial Setup

Before starting any work, read the `README.md` file to understand the project's current state, setup, and any specific instructions.

### After Making Changes

After making any significant changes to the project, update this `GEMINI.md` file to reflect the current state of the application. This includes, but is not limited to:

*   Adding new features.
*   Changing the technology stack.
*   Updating the project's setup or deployment instructions.
*   Updating the "Current State" and "Key Technologies" sections.