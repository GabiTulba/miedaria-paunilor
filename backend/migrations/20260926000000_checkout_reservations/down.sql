DROP INDEX IF EXISTS idx_orders_pending_client;
ALTER TABLE orders DROP COLUMN IF EXISTS client_key_hash;

-- Postgres cannot drop an enum value, so rebuild the type without it.
UPDATE orders SET status = 'pending' WHERE status = 'processing';
DROP INDEX IF EXISTS idx_orders_status_created;
ALTER TYPE order_status_enum RENAME TO order_status_enum_old;
CREATE TYPE order_status_enum AS ENUM ('pending','paid','expired','failed');
ALTER TABLE orders
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE order_status_enum USING status::text::order_status_enum,
    ALTER COLUMN status SET DEFAULT 'pending';
DROP TYPE order_status_enum_old;
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
