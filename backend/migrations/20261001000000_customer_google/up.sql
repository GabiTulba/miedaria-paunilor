-- Sign-in providers linked to a customer account. An identity is keyed by the
-- provider's stable subject id, never by email, so a change of address at the
-- provider cannot attach it to someone else's account.
CREATE TABLE customer_identities (
  provider VARCHAR(16) NOT NULL CHECK (provider IN ('google')),
  subject VARCHAR(255) NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, subject),
  UNIQUE (customer_id, provider)
);

-- Accounts created through Google may have no password. `email_verified_at`
-- now means "the inbox is proven to belong to the account": set by an emailed
-- link, or by Google only for addresses Google is authoritative for.
ALTER TABLE customers DROP CONSTRAINT customers_check;
ALTER TABLE customers ADD CONSTRAINT customers_password_needs_verified_email
  CHECK (hashed_password IS NULL OR email_verified_at IS NOT NULL);
