-- Checkout completed on Stripe but a delayed payment method (bank debit,
-- transfer) has not settled yet: stock stays reserved, but the order is no
-- longer subject to the abandoned-checkout timeout.
ALTER TYPE order_status_enum ADD VALUE 'processing' AFTER 'pending';

-- Pseudonymous per-client key (keyed hash of the client IP, key held only in
-- backend memory) used to cap concurrently pending orders per client. Only
-- set while an order is pending; cleared on any status transition.
ALTER TABLE orders ADD COLUMN client_key_hash VARCHAR(64);

CREATE INDEX idx_orders_pending_client ON orders(client_key_hash, created_at)
    WHERE status = 'pending';
