CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For UUID generation

CREATE TYPE mead_type_enum AS ENUM ('hidromel','melomel','metheglin','bochet','braggot','pyment','cyser','rhodomel','capsicumel','acerglyn');
CREATE TYPE sweetness_type_enum AS ENUM ('bone-dry','dry','semi-dry','semi-sweet','sweet','dessert');
CREATE TYPE turbidity_type_enum AS ENUM ('crystalline','hazy','cloudy');
CREATE TYPE effervescence_type_enum AS ENUM ('flat','perlant','sparkling');
CREATE TYPE acidity_type_enum AS ENUM ('mild','moderate','strong');
CREATE TYPE tannins_type_enum AS ENUM ('mild','moderate','strong');
CREATE TYPE body_type_enum AS ENUM ('light','medium','full');

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(512) NOT NULL UNIQUE,
  storage_path VARCHAR(1024) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  file_size BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id VARCHAR(128) NOT NULL PRIMARY KEY,
  product_name VARCHAR(256) NOT NULL,
  product_name_ro VARCHAR(256) NOT NULL,
  product_description TEXT NOT NULL,
  product_description_ro TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  ingredients_ro TEXT NOT NULL,
  product_type mead_type_enum NOT NULL,
  sweetness sweetness_type_enum NOT NULL,
  turbidity turbidity_type_enum NOT NULL,
  effervescence effervescence_type_enum NOT NULL,
  acidity acidity_type_enum NOT NULL,
  tannins tannins_type_enum NOT NULL,
  body body_type_enum NOT NULL,
  abv DECIMAL(3,1) NOT NULL,
  bottle_count INTEGER NOT NULL,
  bottle_size INTEGER NOT NULL,
  price DECIMAL(5,2) NOT NULL,
  price_ron DECIMAL(7,2) NOT NULL,
  image_id UUID REFERENCES images(id) NOT NULL,
  bottling_date DATE NOT NULL,
  lot_number INTEGER NOT NULL
);

-- Existing admin_users and users tables
CREATE TABLE IF NOT EXISTS admin_users (
  username VARCHAR(256) NOT NULL PRIMARY KEY,
  hashed_password VARCHAR(512) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(256) NOT NULL PRIMARY KEY,
  hashed_password VARCHAR(512) NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(512) NOT NULL,
  title_ro VARCHAR(512) NOT NULL,
  blog_id VARCHAR(256) NOT NULL UNIQUE,
  content_markdown TEXT NOT NULL,
  content_markdown_ro TEXT NOT NULL,
  excerpt VARCHAR(1024) NOT NULL,
  excerpt_ro VARCHAR(1024) NOT NULL,
  author VARCHAR(256) NOT NULL,
  published_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_blog_id ON blog_posts(blog_id);
CREATE INDEX idx_blog_posts_is_published ON blog_posts(is_published);
