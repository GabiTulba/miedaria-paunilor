CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For UUID generation

-- Note: Using text columns instead of ENUM types for simplicity
-- ENUM types would require: CREATE TYPE mead_type_enum AS ENUM (...)
-- and CREATE TYPE sweetness_type_enum as ENUM (...)


CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR NOT NULL UNIQUE,
  storage_path VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  file_size BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id VARCHAR NOT NULL PRIMARY KEY,
  product_name VARCHAR NOT NULL,
  product_name_ro VARCHAR NOT NULL,
  product_description TEXT NOT NULL,
  product_description_ro TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  ingredients_ro TEXT NOT NULL,
  product_type VARCHAR NOT NULL,
  sweetness VARCHAR NOT NULL,
  turbidity VARCHAR NOT NULL,
  effervescence VARCHAR NOT NULL,
  acidity VARCHAR NOT NULL,
  tanins VARCHAR NOT NULL,
  body VARCHAR NOT NULL,
  abv DECIMAL(3,1) NOT NULL,
  bottle_count INTEGER NOT NULL,
  bottle_size INTEGER NOT NULL,
  price DECIMAL(5,2) NOT NULL,
  price_ron DECIMAL(7,2) NOT NULL,
  image_id UUID REFERENCES images(id) NOT NULL
);

-- Existing admin_users and users tables
CREATE TABLE IF NOT EXISTS admin_users (
  username VARCHAR NOT NULL PRIMARY KEY,
  salt VARCHAR NOT NULL,
  hashed_password VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  username VARCHAR NOT NULL PRIMARY KEY,
  salt VARCHAR NOT NULL,
  hashed_password VARCHAR NOT NULL
);
