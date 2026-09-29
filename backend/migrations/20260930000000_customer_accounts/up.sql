-- Unused placeholder from the initial schema; customer accounts live in
-- `customers`.
DROP TABLE IF EXISTS users;

-- Customer accounts, separate from `admin_users`. Registration is email-first:
-- the row exists before a password does, and only the owner of the inbox can
-- set one (through an emailed token), which also verifies the address.
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  -- Argon2id PHC string; NULL until the emailed link is used.
  hashed_password VARCHAR(512),
  email_verified_at TIMESTAMPTZ,
  language VARCHAR(2) NOT NULL CHECK (language IN ('en', 'ro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((hashed_password IS NULL) = (email_verified_at IS NULL))
);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TYPE customer_token_purpose_enum AS ENUM ('set-password', 'change-email');

-- Emailed single-use tokens, stored only as SHA-256 hashes. One live token
-- per customer and purpose: issuing a new one replaces the old.
CREATE TABLE customer_tokens (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose customer_token_purpose_enum NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  -- Target address of an email change; NULL for other purposes.
  new_email VARCHAR(254) CHECK (new_email = lower(new_email)),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, purpose),
  CHECK ((purpose = 'change-email') = (new_email IS NOT NULL))
);

CREATE INDEX idx_customer_tokens_expiry ON customer_tokens(expires_at);

-- Login sessions. The cookie holds a random token; only its SHA-256 hash is
-- stored, so a database leak yields no usable session.
CREATE TABLE customer_sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_customer_sessions_customer ON customer_sessions(customer_id, created_at DESC);
CREATE INDEX idx_customer_sessions_expiry ON customer_sessions(expires_at);

-- Orders stay after their account is deleted (bookkeeping), just detached.
ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
-- Linking guest orders to a newly verified address.
CREATE INDEX idx_orders_guest_email ON orders(lower(customer_email)) WHERE customer_id IS NULL;
