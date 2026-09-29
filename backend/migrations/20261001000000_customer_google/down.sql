DELETE FROM customers WHERE hashed_password IS NULL AND email_verified_at IS NOT NULL;
DELETE FROM customers WHERE hashed_password IS NULL
  AND id IN (SELECT customer_id FROM customer_identities);
DROP TABLE customer_identities;
ALTER TABLE customers DROP CONSTRAINT customers_password_needs_verified_email;
ALTER TABLE customers ADD CONSTRAINT customers_check
  CHECK ((hashed_password IS NULL) = (email_verified_at IS NULL));
