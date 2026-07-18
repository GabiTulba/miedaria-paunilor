-- One row per bottling batch. Rows are kept forever so QR codes printed on
-- already-sold bottles keep resolving after newer batches are bottled.
CREATE TABLE lots (
  lot_number    INTEGER PRIMARY KEY CHECK (lot_number > 0),
  product_id    VARCHAR(128) NOT NULL REFERENCES products(product_id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  -- Batch-varying values are snapshotted here; bilingual/editorial data
  -- (names, descriptions, ingredients, enums, image) joins live from products.
  bottling_date DATE NOT NULL CHECK (bottling_date <= CURRENT_DATE),
  abv           DECIMAL(3,1) NOT NULL CHECK (abv >= 0 AND abv <= 99.9),
  -- EU nutrition declaration, per 100 ml.
  energy_kj     DECIMAL(6,1) NOT NULL CHECK (energy_kj >= 0),
  energy_kcal   DECIMAL(6,1) NOT NULL CHECK (energy_kcal >= 0),
  fat           DECIMAL(5,2) NOT NULL CHECK (fat >= 0),
  saturates     DECIMAL(5,2) NOT NULL CHECK (saturates >= 0),
  carbohydrates DECIMAL(5,2) NOT NULL CHECK (carbohydrates >= 0),
  sugars        DECIMAL(5,2) NOT NULL CHECK (sugars >= 0),
  protein       DECIMAL(5,2) NOT NULL CHECK (protein >= 0),
  salt          DECIMAL(5,2) NOT NULL CHECK (salt >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lots_product_id ON lots(product_id);

CREATE TRIGGER trg_lots_updated_at
    BEFORE UPDATE ON lots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
