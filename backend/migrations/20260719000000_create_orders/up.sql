CREATE TYPE order_status_enum AS ENUM ('pending','paid','expired','failed');

CREATE TABLE orders (
  order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status order_status_enum NOT NULL DEFAULT 'pending',
  currency VARCHAR(3) NOT NULL,
  total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents > 0),
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  customer_email VARCHAR(255),
  language VARCHAR(2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  order_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  -- Products are soft-deleted, so the FK stays valid for order history.
  product_id VARCHAR(128) NOT NULL REFERENCES products(product_id),
  product_name VARCHAR(256) NOT NULL,
  unit_amount_cents BIGINT NOT NULL CHECK (unit_amount_cents > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (order_id, product_id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
