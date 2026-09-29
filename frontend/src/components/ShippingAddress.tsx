import { useTranslation } from 'react-i18next';

type ShippingFields = {
    shipping_name: string | null;
    shipping_phone: string | null;
    shipping_line1: string | null;
    shipping_line2: string | null;
    shipping_city: string | null;
    shipping_state: string | null;
    shipping_postal_code: string | null;
    shipping_country: string | null;
};

/// The delivery address Stripe collected for an order, or null if it has none.
function ShippingAddress({ order }: { order: ShippingFields }) {
    const { t } = useTranslation();
    if (!order.shipping_line1) return null;
    return (
        <address className="order-shipping-address">
            {order.shipping_name && <>{order.shipping_name}<br /></>}
            {order.shipping_line1}<br />
            {order.shipping_line2 && <>{order.shipping_line2}<br /></>}
            {[order.shipping_postal_code, order.shipping_city].filter(Boolean).join(' ')}<br />
            {[order.shipping_state, order.shipping_country].filter(Boolean).join(', ')}
            {order.shipping_phone && (
                <>
                    <br />
                    {t('admin.orders.shipping.phone')}:{' '}
                    <a href={`tel:${order.shipping_phone}`}>{order.shipping_phone}</a>
                </>
            )}
        </address>
    );
}

export default ShippingAddress;
