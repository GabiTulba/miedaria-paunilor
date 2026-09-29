DROP INDEX idx_orders_guest_email;
DROP INDEX idx_orders_customer;
ALTER TABLE orders DROP COLUMN customer_id;
DROP TABLE customer_sessions;
DROP TABLE customer_tokens;
DROP TYPE customer_token_purpose_enum;
DROP TABLE customers;

CREATE TABLE users (
  username VARCHAR(256) NOT NULL PRIMARY KEY,
  hashed_password VARCHAR(512) NOT NULL
);
