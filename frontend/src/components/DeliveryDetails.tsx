import { useTranslation } from 'react-i18next';
import { useFormattedDate } from '../hooks/useFormattedDate';
import type { OrderDelivery } from '../types/generated/OrderDelivery';
import type { ShipmentTracking } from '../types/generated/ShipmentTracking';

// Mirror of `sameday::TRACKING_URL` in the backend.
const SAMEDAY_TRACKING_URL = 'https://sameday.ro/#awb=';

/// How an order is delivered: the method, the easybox or the address Stripe
/// collected, the recipient's phone and, once shipped, the Sameday waybill.
/// Renders nothing when the order holds no delivery details yet.
function DeliveryDetails({ order, tracking }: { order: OrderDelivery; tracking?: ShipmentTracking | null }) {
    const { t } = useTranslation();
    const formatDate = useFormattedDate();
    const isLocker = order.delivery_method === 'easybox';
    if (!order.shipping_line1 && !order.locker_name) return null;
    return (
        <div className="order-delivery">
            <p className="order-delivery-method">{t(`cart.delivery.${order.delivery_method}`)}</p>
            <address className="order-shipping-address">
                {order.shipping_name && <>{order.shipping_name}<br /></>}
                {isLocker ? (
                    <>
                        {order.locker_name}<br />
                        {order.locker_address}<br />
                        {[order.locker_postal_code, order.locker_city].filter(Boolean).join(' ')}
                        {order.locker_county && <>, {order.locker_county}</>}
                    </>
                ) : (
                    <>
                        {order.shipping_line1}<br />
                        {order.shipping_line2 && <>{order.shipping_line2}<br /></>}
                        {[order.shipping_postal_code, order.shipping_city].filter(Boolean).join(' ')}<br />
                        {[order.shipping_state, order.shipping_country].filter(Boolean).join(', ')}
                    </>
                )}
                {order.shipping_phone && (
                    <>
                        <br />
                        {t('admin.orders.shipping.phone')}:{' '}
                        <a href={`tel:${order.shipping_phone}`}>{order.shipping_phone}</a>
                    </>
                )}
            </address>
            {tracking?.awb_number && (
                <p className="order-tracking">
                    {t('orderTracking.awb')}:{' '}
                    <a
                        href={`${SAMEDAY_TRACKING_URL}${encodeURIComponent(tracking.awb_number)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {tracking.awb_number}
                    </a>
                    <br />
                    {tracking.delivered_at
                        ? t('orderTracking.delivered', { date: formatDate(tracking.delivered_at) })
                        : tracking.canceled
                            ? t('orderTracking.canceled')
                            : tracking.status_label ?? t('orderTracking.handedOver')}
                </p>
            )}
        </div>
    );
}

export default DeliveryDetails;
