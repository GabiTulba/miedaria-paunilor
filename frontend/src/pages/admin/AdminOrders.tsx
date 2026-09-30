import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useFormattedDate } from '../../hooks/useFormattedDate';
import { useFetch } from '../../hooks/useFetch';
import { usePageParam } from '../../hooks/usePageParam';
import Pagination from '../../components/Pagination';
import OrderShipment from './OrderShipment';
import { formatAmount } from '../../utils/numberUtils';
import ErrorDisplay from '../../components/ErrorDisplay';
import { OrderStatus } from '../../types/generated/OrderStatus';
import type { OrderWithItems } from '../../types/generated/OrderWithItems';
import './Admin.css';

const ADMIN_ORDERS_PER_PAGE = 20;

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
    paid: 'status-active',
    pending: 'status-draft',
    processing: 'status-draft',
    expired: 'status-inactive',
    failed: 'status-inactive',
};

function AdminOrders() {
    const [page, setPage] = usePageParam();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, OrderWithItems>>({});
    const { t } = useTranslation();
    const formatDateOptions = useMemo(() => ({
        year: 'numeric' as const,
        month: 'short' as const,
        day: 'numeric' as const,
        hour: '2-digit' as const,
        minute: '2-digit' as const,
    }), []);
    const formatDate = useFormattedDate(formatDateOptions);

    const { data, loading, error, refetch } = useFetch(
        signal => api.getAdminOrders(page, ADMIN_ORDERS_PER_PAGE, signal),
        [page],
    );
    const orders = data?.items ?? [];
    const totalPages = data?.total_pages ?? 1;
    const hasMore = page < totalPages;

    const toggleExpand = async (orderId: string) => {
        if (expandedId === orderId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(orderId);
        if (!details[orderId]) {
            try {
                const detail = await api.getAdminOrder(orderId);
                setDetails(prev => ({ ...prev, [orderId]: detail }));
            } catch (err) {
                console.error('Failed to load order detail:', err);
            }
        }
    };

    if (error) {
        return (
            <div className="admin-content">
                <ErrorDisplay
                    error={t('admin.orders.error')}
                    onRetry={refetch}
                    retryLabel={t('admin.products.retry')}
                />
            </div>
        );
    }

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-content">
                    <h1>{t('admin.orders.title')}</h1>
                    <p>{t('admin.orders.subtitle')}</p>
                </div>
            </div>

            {orders.length === 0 && page === 1 && !loading ? (
                <div className="empty-state">
                    <h3>{t('admin.orders.noOrders')}</h3>
                    <p>{t('admin.orders.noOrdersDescription')}</p>
                </div>
            ) : loading ? (
                <div className="loading-state">
                    <div className="loading-icon"></div>
                    <p>{t('common.loading')}</p>
                </div>
            ) : (
                <>
                <div className="admin-table-container">
                    <table className="admin-table">
                        <colgroup>
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '15%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>{t('admin.orders.table.date')}</th>
                                <th>{t('admin.orders.table.status')}</th>
                                <th>{t('admin.orders.table.email')}</th>
                                <th>{t('admin.orders.table.total')}</th>
                                <th>{t('admin.orders.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <Fragment key={order.order_id}>
                                    <tr>
                                        <td data-label={t('admin.orders.table.date')}>{formatDate(order.created_at)}</td>
                                        <td data-label={t('admin.orders.table.status')}>
                                            <span className={`status-badge ${STATUS_BADGE_CLASS[order.status]}`}>
                                                {t(`admin.orders.status.${order.status}`)}
                                            </span>
                                        </td>
                                        <td data-label={t('admin.orders.table.email')}>{order.anonymized_at ? t('admin.orders.anonymized') : order.customer_email ?? '—'}</td>
                                        <td data-label={t('admin.orders.table.total')}>
                                            {formatAmount(order.total_amount_cents, order.currency)}
                                            <br />
                                            <small>{t(`cart.delivery.${order.delivery_method}`)}</small>
                                        </td>
                                        <td data-label={t('admin.orders.table.actions')}>
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => toggleExpand(order.order_id)}
                                                    className="button button-small button-secondary"
                                                >
                                                    {expandedId === order.order_id ? t('common.close') : t('admin.orders.viewItems')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedId === order.order_id && (
                                        <tr>
                                            <td colSpan={5} className="order-detail-cell">
                                                <div className="order-detail">
                                                    <div className="order-detail-section">
                                                        <h4>{t('admin.orders.items')}</h4>
                                                        {details[order.order_id] ? (
                                                            <ul className="order-items-list">
                                                                {details[order.order_id].items.map(item => (
                                                                    <li key={item.order_item_id}>
                                                                        {item.quantity} × {item.product_name} — {formatAmount(item.unit_amount_cents, order.currency)}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p>{t('common.loading')}</p>
                                                        )}
                                                    </div>
                                                    {details[order.order_id] && (
                                                        <OrderShipment
                                                            detail={details[order.order_id]}
                                                            onShipmentChange={shipment => setDetails(prev => ({
                                                                ...prev,
                                                                [order.order_id]: { ...prev[order.order_id], shipment },
                                                            }))}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    page={page}
                    hasMore={hasMore}
                    totalPages={totalPages}
                    onPrevPage={() => setPage(page - 1)}
                    onNextPage={() => setPage(page + 1)}
                />
                </>
            )}
        </div>
    );
}

export default AdminOrders;
