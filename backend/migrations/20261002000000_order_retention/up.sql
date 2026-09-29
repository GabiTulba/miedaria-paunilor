-- When an order's personal data (contact, delivery address, account link,
-- Stripe references) was erased at the end of its retention period. The
-- anonymous remainder (amounts, products, dates) stays for the books and
-- the sales statistics.
ALTER TABLE orders ADD COLUMN anonymized_at TIMESTAMPTZ;
CREATE INDEX idx_orders_awaiting_anonymization ON orders(created_at) WHERE anonymized_at IS NULL;
