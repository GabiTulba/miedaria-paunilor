DROP TABLE shipments;
DROP TABLE sameday_lockers;
ALTER TABLE orders
    DROP CONSTRAINT orders_locker_only_for_easybox,
    DROP COLUMN delivery_method,
    DROP COLUMN shipping_amount_cents,
    DROP COLUMN age_confirmed_at,
    DROP COLUMN locker_id,
    DROP COLUMN locker_name,
    DROP COLUMN locker_address,
    DROP COLUMN locker_city,
    DROP COLUMN locker_county,
    DROP COLUMN locker_postal_code;
ALTER TABLE products DROP COLUMN weight_grams;
DROP TABLE shipping_rates;
DROP TYPE delivery_method_enum;
