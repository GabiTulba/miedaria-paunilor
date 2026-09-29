import type { OrderStatus } from '../../types/generated/OrderStatus';

/// Badge class per status; reuses the shared status badge styles.
export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
    paid: 'status-active',
    pending: 'status-draft',
    processing: 'status-draft',
    expired: 'status-inactive',
    failed: 'status-inactive',
};
