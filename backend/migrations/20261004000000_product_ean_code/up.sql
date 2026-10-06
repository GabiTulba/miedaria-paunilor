-- The product's EAN-13 (GS1) code, printed as the barcode on its back label
-- and registered with the SGR deposit-return system. Optional until assigned;
-- one product per code.
ALTER TABLE products
    ADD COLUMN ean_code VARCHAR(13),
    ADD CONSTRAINT products_ean_code_check CHECK (ean_code ~ '^[0-9]{13}$'),
    ADD CONSTRAINT products_ean_code_key UNIQUE (ean_code);
