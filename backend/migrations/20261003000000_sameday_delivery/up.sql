CREATE TYPE delivery_method_enum AS ENUM ('home', 'easybox');

-- Flat shipping price per delivery method, free from `free_from_cents` of
-- products (NULL: never free). Edited from the admin Shipping page.
CREATE TABLE shipping_rates (
    delivery_method delivery_method_enum PRIMARY KEY,
    price_cents     BIGINT NOT NULL CHECK (price_cents BETWEEN 0 AND 100000),
    free_from_cents BIGINT CHECK (free_from_cents BETWEEN 1 AND 10000000),
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO shipping_rates (delivery_method, price_cents, free_from_cents) VALUES
    ('home', 2000, 25000),
    ('easybox', 1500, 25000);
CREATE TRIGGER trg_shipping_rates_updated_at
    BEFORE UPDATE ON shipping_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Packed weight of one bottle (glass, liquid and its share of the box), for
-- waybills and the easybox weight limit. Seeded at 1.8 g per ml.
ALTER TABLE products ADD COLUMN weight_grams INT;
UPDATE products SET weight_grams = LEAST(30000, GREATEST(1, bottle_size * 18 / 10));
ALTER TABLE products
    ALTER COLUMN weight_grams SET NOT NULL,
    ADD CONSTRAINT products_weight_grams_check CHECK (weight_grams BETWEEN 1 AND 30000);

-- Delivery chosen in the cart. `total_amount_cents` includes the shipping
-- amount; `order_items` still hold the products alone. The locker columns
-- are a snapshot of the easybox chosen, taken when the order is placed.
ALTER TABLE orders
    ADD COLUMN delivery_method       delivery_method_enum NOT NULL DEFAULT 'home',
    ADD COLUMN shipping_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (shipping_amount_cents >= 0),
    ADD COLUMN age_confirmed_at      TIMESTAMPTZ,
    ADD COLUMN locker_id             INT,
    ADD COLUMN locker_name           VARCHAR(255),
    ADD COLUMN locker_address        VARCHAR(512),
    ADD COLUMN locker_city           VARCHAR(255),
    ADD COLUMN locker_county         VARCHAR(255),
    ADD COLUMN locker_postal_code    VARCHAR(32),
    ADD CONSTRAINT orders_locker_only_for_easybox
        CHECK (delivery_method = 'easybox' OR locker_id IS NULL);

-- Sameday's easybox lockers, synced daily. Checkout accepts only a locker
-- listed here and copies its address from here, never from the browser.
CREATE TABLE sameday_lockers (
    locker_id   INT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    county      VARCHAR(255) NOT NULL,
    city        VARCHAR(255) NOT NULL,
    address     VARCHAR(512) NOT NULL,
    postal_code VARCHAR(32) NOT NULL,
    synced_at   TIMESTAMPTZ NOT NULL
);

-- The Sameday waybill (AWB) of an order: at most one live per order.
-- `awb_number` is erased with the order's personal data, since Sameday
-- looks the recipient up by it.
CREATE TABLE shipments (
    order_id            UUID PRIMARY KEY REFERENCES orders(order_id) ON DELETE CASCADE,
    awb_number          VARCHAR(64) UNIQUE,
    service_code        VARCHAR(8) NOT NULL,
    parcel_count        INT NOT NULL CHECK (parcel_count BETWEEN 1 AND 20),
    weight_grams        INT NOT NULL CHECK (weight_grams BETWEEN 1 AND 1000000),
    insured_value_cents BIGINT NOT NULL DEFAULT 0 CHECK (insured_value_cents >= 0),
    cost_cents          BIGINT,
    status_label        VARCHAR(255),
    status_at           TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    canceled            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipments_in_transit ON shipments(created_at)
    WHERE delivered_at IS NULL AND NOT canceled AND awb_number IS NOT NULL;
CREATE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
