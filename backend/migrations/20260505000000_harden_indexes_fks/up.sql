-- Replace the products.image_id FK with ON DELETE SET NULL so deleting an
-- image leaves products in place with a null image rather than failing the
-- delete with an FK violation.
ALTER TABLE products
    DROP CONSTRAINT products_image_id_fkey,
    ADD CONSTRAINT products_image_id_fkey
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE SET NULL;

-- Speed up FK-driven joins (product list with image) and admin archive views.
CREATE INDEX idx_products_image_id ON products(image_id);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite index for the public blog list query
-- (WHERE is_published = TRUE ORDER BY published_at DESC).
CREATE INDEX idx_blog_posts_pub_pubat ON blog_posts(is_published, published_at DESC);
