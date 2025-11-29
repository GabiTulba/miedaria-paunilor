CREATE TABLE IF NOT EXISTS products (
  product_id VARCHAR NOT NULL PRIMARY KEY,
  product_name VARCHAR NOT NULL,
  product_description TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  abv DECIMAL(2,1) NOT NULL,
  bottle_count INTEGER NOT NULL,
  bottle_size INTEGER NOT NULL,
  price DECIMAL(3,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  username VARCHAR NOT NULL PRIMARY KEY,
  salt VARCHAR NOT NULL,
  hashed_password VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  username VARCHAR NOT NULL PRIMARY KEY,
  salt VARCHAR NOT NULL,
  hashed_password VARCHAR NOT NULL
)