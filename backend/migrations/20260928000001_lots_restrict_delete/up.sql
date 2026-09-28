-- Lot rows back the QR codes printed on bottles already sold, so deleting a
-- product must never take them with it: refuse instead of cascading.
ALTER TABLE lots
    DROP CONSTRAINT lots_product_id_fkey,
    ADD CONSTRAINT lots_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
