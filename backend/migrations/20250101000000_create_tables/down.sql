DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
DROP FUNCTION IF EXISTS update_updated_at();

DROP TABLE IF EXISTS blog_posts;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS mead_type_enum;
DROP TYPE IF EXISTS sweetness_type_enum;
DROP TYPE IF EXISTS turbidity_type_enum;
DROP TYPE IF EXISTS effervescence_type_enum;
DROP TYPE IF EXISTS acidity_type_enum;
DROP TYPE IF EXISTS tannins_type_enum;
DROP TYPE IF EXISTS body_type_enum;
