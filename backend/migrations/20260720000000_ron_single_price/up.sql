-- RON is the only price admins enter and customers are charged in; EUR display
-- prices are derived at read time from the official BNR reference rate.
ALTER TABLE products DROP COLUMN price;

CREATE TABLE exchange_rates (
  currency VARCHAR(3) NOT NULL,
  rate_date DATE NOT NULL,
  -- RON per one unit of `currency`, as published by BNR.
  rate DECIMAL(10,4) NOT NULL CHECK (rate > 0),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (currency, rate_date)
);
