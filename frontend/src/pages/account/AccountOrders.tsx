import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorDisplay from '../../components/ErrorDisplay';
import { LocalizedLink } from '../../components/LocalizedLink';
import Pagination from '../../components/Pagination';
import { useFetch } from '../../hooks/useFetch';
import { useFormattedDate } from '../../hooks/useFormattedDate';
import { usePageParam } from '../../hooks/usePageParam';
import { api } from '../../lib/api';
import { formatAmount } from '../../utils/numberUtils';
import AccountLayout from './AccountLayout';
import AccountNav from './AccountNav';
import { ORDER_STATUS_CLASS } from './orderStatus';

function AccountOrders() {
    const { t } = useTranslation();
    const [page, setPage] = usePageParam();
    const dateOptions = useMemo(() => ({ year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const }), []);
    const formatDate = useFormattedDate(dateOptions);
    const { data, loading, error, refetch } = useFetch(signal => api.getAccountOrders(page, signal), [page]);
    const orders = data?.items ?? [];
    const totalPages = data?.total_pages ?? 1;

    return (
        <AccountLayout title={t('account.orders.title')} wide>
            <AccountNav />
            {error ? (
                <ErrorDisplay error={t('account.orders.error')} onRetry={refetch} retryLabel={t('common.retry')} />
            ) : loading ? (
                <p>{t('common.loading')}</p>
            ) : orders.length === 0 ? (
                <div className="account-empty">
                    <p>{t('account.orders.empty')}</p>
                    <LocalizedLink to="/shop" className="button">{t('cart.continueShopping')}</LocalizedLink>
                </div>
            ) : (
                <>
                    <ul className="account-order-list">
                        {orders.map(order => (
                            <li key={order.order_id}>
                                <LocalizedLink to={`/account/orders/${order.order_id}`} className="account-order-card">
                                    <span>{formatDate(order.created_at)}</span>
                                    <span className={`status-badge ${ORDER_STATUS_CLASS[order.status]}`}>
                                        {t(`admin.orders.status.${order.status}`)}
                                    </span>
                                    <strong>{formatAmount(order.total_amount_cents, order.currency)}</strong>
                                </LocalizedLink>
                            </li>
                        ))}
                    </ul>
                    <Pagination
                        page={page}
                        hasMore={page < totalPages}
                        totalPages={totalPages}
                        onPrevPage={() => setPage(page - 1)}
                        onNextPage={() => setPage(page + 1)}
                    />
                </>
            )}
        </AccountLayout>
    );
}

export default AccountOrders;
