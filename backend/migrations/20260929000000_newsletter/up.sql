-- Double opt-in newsletter list. A row is only a subscription once
-- `confirmed_at` is set (the proof-of-consent timestamp); unconfirmed rows
-- are purged when their token expires, and unsubscribing deletes the row.
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  language VARCHAR(2) NOT NULL CHECK (language IN ('en', 'ro')),
  confirmed_at TIMESTAMPTZ,
  -- SHA-256 of the single-use confirmation token; the token itself is only
  -- ever in the confirmation email.
  confirmation_token_hash VARCHAR(64) UNIQUE,
  confirmation_sent_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_newsletter_unconfirmed_expiry
  ON newsletter_subscribers(token_expires_at)
  WHERE confirmed_at IS NULL;

-- When the post was last emailed to subscribers; guards against accidental
-- duplicate sends.
ALTER TABLE blog_posts ADD COLUMN notified_at TIMESTAMPTZ;

-- `updated_at` is the post's sitemap/RSS lastmod, so recording an
-- announcement must not bump it: only content changes do.
CREATE FUNCTION update_blog_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF to_jsonb(NEW) - 'notified_at' - 'updated_at'
       IS DISTINCT FROM to_jsonb(OLD) - 'notified_at' - 'updated_at' THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_blog_post_updated_at();
