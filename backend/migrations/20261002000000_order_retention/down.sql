DROP INDEX idx_orders_awaiting_anonymization;
ALTER TABLE orders DROP COLUMN anonymized_at;
