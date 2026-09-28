ALTER TABLE lots
    DROP CONSTRAINT lots_product_id_fkey,
    ADD CONSTRAINT lots_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(product_id)
        ON UPDATE CASCADE ON DELETE CASCADE;
