CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image VARCHAR(255),
  size INT,
  price DECIMAL(10, 2),
  availability INT,
  organoleptic VARCHAR(255),
  taste VARCHAR(255),
  smell VARCHAR(255),
  body VARCHAR(255),
  alcohol DECIMAL(4, 2),
  ingredients TEXT
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

INSERT INTO users (username, password) VALUES ('admin', 'admin');