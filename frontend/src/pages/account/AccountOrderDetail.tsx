import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import ErrorDisplay from '../../components/ErrorDisplay';
import { LocalizedLink } from '../../components/LocalizedLink';
import DeliveryDetails from '../../components/DeliveryDetails';
import { useFetch } from '../../hooks/useFetch';
import { useFormattedDate } from '../../hooks/useFormattedDate';
import { api } from '../../lib/api';
import type { ApiError } from '../../types/api';
import { formatAmount } from '../../utils/numberUtils';
import AccountLayout from './AccountLayout';
import AccountNav from './AccountNav';
import { ORDER_STATUS_CLASS } from './orderStatus';

function AccountOrderDetail() {
    const { t } = useTranslation();
    const { orderId = '' } = useParams();
    const dateOptions = useMemo(() => ({
        year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const,
        hour: '2-digit' as const, minute: '2-digit' as const,
    }), []);
    const formatDate = useFormattedDate(dateOptions);
    const { data: order, loading, error, refetch } = useFetch(signal => api.getAccountOrder(orderId, signal), [orderId]);
    const notFound = (error as ApiError | null)?.response?.status === 404;

    return (
        <AccountLayout title={t('account.order.title')} wide>
            <AccountNav />
            {notFound ? (
                <p className="account-error">{t('account.order.notFound')}</p>
            ) : error ? (
                <ErrorDisplay error={t('account.orders.error')} onRetry={refetch} retryLabel={t('common.retry')} />
            ) : loading || !order ? (
                <p>{t('common.loading')}</p>
            ) : (
                <article className="account-order-detail">
                    <dl className="account-order-facts">
                        <dt>{t('account.order.placed')}</dt>
                        <dd>{formatDate(order.created_at)}</dd>
                        <dt>{t('admin.orders.table.status')}</dt>
                        <dd>
                            <span className={`status-badge ${ORDER_STATUS_CLASS[order.status]}`}>
                                {t(`admin.orders.status.${order.status}`)}
                            </span>
                        </dd>
                        <dt>{t('account.order.number')}</dt>
                        <dd><code>{order.order_id}</code></dd>
                    </dl>
                    <h2>{t('admin.orders.items')}</h2>
                    <table className="account-order-items">
                        <tbody>
                            {order.items.map(item => (
                                <tr key={item.order_item_id}>
                                    <td>{item.quantity} × {item.product_name}</td>
                                    <td>{formatAmount(item.unit_amount_cents * item.quantity, order.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            {order.shipping_amount_cents > 0 && (
                                <tr>
                                    <th scope="row">{t('cart.delivery.shipping')}</th>
                                    <td>{formatAmount(order.shipping_amount_cents, order.currency)}</td>
                                </tr>
                            )}
                            <tr>
                                <th scope="row">{t('cart.total')}</th>
                                <td>{formatAmount(order.total_amount_cents, order.currency)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    {(order.shipping_line1 || order.locker_name) && (
                        <>
                            <h2>{t('admin.orders.shipping.title')}</h2>
                            <DeliveryDetails order={order} tracking={order.tracking} />
                        </>
                    )}
                </article>
            )}
            <p className="account-links">
                <LocalizedLink to="/account">{t('account.order.back')}</LocalizedLink>
            </p>
        </AccountLayout>
    );
}

export default AccountOrderDetail;
