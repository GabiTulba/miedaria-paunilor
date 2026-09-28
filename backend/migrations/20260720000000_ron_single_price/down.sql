-- Restore an EUR price column, approximated from the latest known BNR rate.
ALTER TABLE products ADD COLUMN price DECIMAL(7,2);
UPDATE products SET price = GREATEST(
  ROUND(price_ron / COALESCE(
    (SELECT rate FROM exchange_rates WHERE currency = 'EUR' ORDER BY rate_date DESC LIMIT 1),
    5
  ), 2),
  0.01
);
ALTER TABLE products ALTER COLUMN price SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price > 0);

DROP TABLE exchange_rates;
