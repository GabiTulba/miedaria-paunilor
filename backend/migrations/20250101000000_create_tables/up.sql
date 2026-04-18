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
  file_name VARCHAR(512) NOT NULL,
  storage_path VARCHAR(1024) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  abv DECIMAL(3,1) NOT NULL CHECK (abv >= 0 AND abv <= 99.9),
  bottle_count INTEGER NOT NULL CHECK (bottle_count >= 0),
  bottle_size INTEGER NOT NULL CHECK (bottle_size > 0),
  price DECIMAL(7,2) NOT NULL CHECK (price > 0),
  price_ron DECIMAL(7,2) NOT NULL CHECK (price_ron > 0),
  image_id UUID REFERENCES images(id),
  bottling_date DATE NOT NULL CHECK (bottling_date <= CURRENT_DATE),
  lot_number INTEGER NOT NULL CHECK (lot_number > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_product_type ON products(product_type);
CREATE INDEX idx_products_bottle_count ON products(bottle_count);
CREATE INDEX idx_products_bottling_date ON products(bottling_date DESC);
CREATE INDEX idx_products_sweetness ON products(sweetness);
CREATE INDEX idx_products_in_stock ON products(bottling_date DESC) WHERE bottle_count > 0;

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
  slug VARCHAR(256) NOT NULL UNIQUE,
  content_markdown TEXT NOT NULL,
  content_markdown_ro TEXT NOT NULL,
  excerpt VARCHAR(1024) NOT NULL,
  excerpt_ro VARCHAR(1024) NOT NULL,
  author VARCHAR(256) NOT NULL,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_is_published ON blog_posts(is_published);

-- Auto-update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
