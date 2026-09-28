-- Delivery details collected by Stripe Checkout and copied onto the order by
-- the webhook, so every paid order carries the address it must ship to as it
-- was at purchase time (independent of any future customer address book).
ALTER TABLE orders
    ADD COLUMN shipping_name        VARCHAR(255),
    ADD COLUMN shipping_phone       VARCHAR(64),
    ADD COLUMN shipping_line1       VARCHAR(255),
    ADD COLUMN shipping_line2       VARCHAR(255),
    ADD COLUMN shipping_city        VARCHAR(255),
    ADD COLUMN shipping_state       VARCHAR(255),
    ADD COLUMN shipping_postal_code VARCHAR(32),
    ADD COLUMN shipping_country     VARCHAR(2);
