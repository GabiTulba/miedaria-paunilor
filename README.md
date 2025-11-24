# Miedăria Păunilor - E-commerce Prototype

This project is a prototype for the official website of Miedăria Păunilor, a traditional meadery. The website serves as a digital storefront, showcasing unique mead products.

## Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/)
*   **Library**: [React](https://reactjs.org/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Database**: [MySQL](https://www.mysql.com/)

## Current Features

*   **Home Page**: A landing page with a preview of mead products.
*   **Shop Page**: A dedicated page at `/shop` that displays all available products.
*   **Dynamic Product Pages**: Individual pages for each mead product.
*   **Database Integration**: The project is connected to a MySQL database to store and manage products and users.
*   **Admin Panel**: An enhanced admin panel at `/admin/login` offering comprehensive product management (add, edit, delete), token-based user display, and robust security for administrative routes.

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file:

`MYSQL_HOST=mysql`
`MYSQL_DATABASE=miedaria-paunilor`
`MYSQL_USER=admin`
`MYSQL_PASSWORD=admin`
`MYSQL_ROOT_PASSWORD=root`
`ADMIN_USER=admin`
`ADMIN_PASSWORD=admin`
`JWT_SECRET=your_jwt_secret_key`

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Docker](https://www.docker.com/get-started)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### Installation and Running with Docker

1.  Clone the repo
    ```sh
    git clone https://github.com/your_username_/miedaria-paunilor.git
    ```
2.  Navigate to the project directory
    ```sh
    cd miedaria-paunilor
    ```
3.  Create a `.env` file and add the environment variables mentioned above.
4.  Build and run the Docker containers
    ```sh
    docker-compose up --build
    ```

The application will be accessible at [http://localhost:3000](http://localhost:3000).
The admin panel is accessible at [http://localhost:3000/admin/login](http://localhost:3000/admin/login). The default credentials are `admin` and `admin`.