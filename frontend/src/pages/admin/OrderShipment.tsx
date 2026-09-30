import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../../components/ConfirmModal';
import DeliveryDetails from '../../components/DeliveryDetails';
import { api } from '../../lib/api';
import type { ApiError } from '../../types/api';
import type { OrderWithItems } from '../../types/generated/OrderWithItems';
import type { Shipment } from '../../types/generated/Shipment';

const MAX_PARCELS = 20;

function errorMessage(err: unknown, t: (key: string) => string): string {
    const response = (err as Partial<ApiError>).response;
    if (response?.status === 409 && response.data?.message) return response.data.message;
    if (response?.status === 503) return response.data?.message ?? t('admin.orders.awb.unavailable');
    return t('admin.orders.awb.error');
}

/// Delivery details of an order and its Sameday waybill: generate one for a
/// paid order once the parcel is packed, print the label, or cancel it
/// before the courier picks it up.
function OrderShipment({ detail, onShipmentChange }: {
    detail: OrderWithItems;
    onShipmentChange: (shipment: Shipment | null) => void;
}) {
    const { t } = useTranslation();
    const { order, shipment } = detail;
    const [parcelCount, setParcelCount] = useState(1);
    const [weightKg, setWeightKg] = useState('');
    const [insured, setInsured] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const canShip = order.status === 'paid' && !order.anonymized_at && !shipment;

    useEffect(() => {
        if (!canShip) return;
        const controller = new AbortController();
        api.getShipmentWeight(order.order_id, controller.signal)
            .then(grams => setWeightKg((grams / 1000).toFixed(2)))
            .catch(() => {
                // Left empty: the admin weighs the parcel.
            });
        return () => controller.abort();
    }, [canShip, order.order_id]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (err) {
            console.error('Waybill action failed:', err);
            setError(errorMessage(err, t));
        } finally {
            setBusy(false);
        }
    };

    const createAwb = () => run(async () => {
        const created = await api.createShipment(order.order_id, {
            parcel_count: parcelCount,
            weight_grams: Math.round(Number(weightKg) * 1000),
            insured,
        });
        onShipmentChange(created);
    });

    const downloadLabel = () => run(async () => {
        const blob = await api.downloadShipmentLabel(order.order_id);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `awb-${shipment?.awb_number ?? order.order_id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    });

    const cancelAwb = () => {
        setConfirmCancel(false);
        return run(async () => {
            await api.cancelShipment(order.order_id);
            onShipmentChange(null);
        });
    };

    const weightValid = Number(weightKg) > 0 && Number(weightKg) <= 1000;

    return (
        <div className="order-detail-section">
            <h4>{t('admin.orders.shipping.title')}</h4>
            {order.anonymized_at ? (
                <p className="order-shipping-missing">{t('admin.orders.anonymized')}</p>
            ) : order.shipping_line1 || order.locker_name ? (
                <DeliveryDetails order={order} tracking={shipment} />
            ) : (
                <p className="order-shipping-missing">{t('admin.orders.shipping.missing')}</p>
            )}
            {order.shipping_amount_cents > 0 && (
                <p>{t('cart.delivery.shipping')}: {(order.shipping_amount_cents / 100).toFixed(2)} {order.currency}</p>
            )}

            {shipment?.awb_number && (
                <div className="action-buttons">
                    <button className="button button-small" onClick={downloadLabel} disabled={busy}>
                        {t('admin.orders.awb.label')}
                    </button>
                    {!shipment.delivered_at && !shipment.canceled && (
                        <button className="button button-small button-danger" onClick={() => setConfirmCancel(true)} disabled={busy}>
                            {t('admin.orders.awb.cancel')}
                        </button>
                    )}
                </div>
            )}

            {canShip && (
                <div className="awb-form">
                    <label>
                        {t('admin.orders.awb.parcels')}
                        <input
                            type="number"
                            className="form-input"
                            min={1}
                            max={MAX_PARCELS}
                            value={parcelCount}
                            onChange={e => setParcelCount(Math.min(MAX_PARCELS, Math.max(1, Number(e.target.value) || 1)))}
                        />
                    </label>
                    <label>
                        {t('admin.orders.awb.weight')}
                        <input
                            type="number"
                            className="form-input"
                            min={0.01}
                            step={0.01}
                            value={weightKg}
                            onChange={e => setWeightKg(e.target.value)}
                        />
                    </label>
                    <label className="awb-form-checkbox">
                        <input type="checkbox" checked={insured} onChange={e => setInsured(e.target.checked)} />
                        {t('admin.orders.awb.insured')}
                    </label>
                    <button className="button button-small" onClick={createAwb} disabled={busy || !weightValid}>
                        {busy ? t('common.loading') : t('admin.orders.awb.create')}
                    </button>
                </div>
            )}
            {error && <p className="error-message" role="alert">{error}</p>}
            {confirmCancel && (
                <ConfirmModal
                    title={t('admin.orders.awb.cancelTitle')}
                    message={t('admin.orders.awb.cancelMessage', { awb: shipment?.awb_number ?? '' })}
                    confirmLabel={t('admin.orders.awb.cancel')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={cancelAwb}
                    onCancel={() => setConfirmCancel(false)}
                />
            )}
        </div>
    );
}

export default OrderShipment;
