DROP INDEX IF EXISTS idx_blog_posts_pub_pubat;
DROP INDEX IF EXISTS idx_products_deleted_at;
DROP INDEX IF EXISTS idx_products_image_id;

ALTER TABLE products
    DROP CONSTRAINT products_image_id_fkey,
    ADD CONSTRAINT products_image_id_fkey
        FOREIGN KEY (image_id) REFERENCES images(id);
