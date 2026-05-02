import { useEffect, useState, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductWithImage } from '../../types';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { getStockStatus } from '../../utils/stockAvailability';
import { getImageUrl } from '../../lib/api';
import { toFixed } from '../../utils/numberUtils';
import Pagination from '../../components/Pagination';
import ErrorDisplay from '../../components/ErrorDisplay';
import ConfirmModal from '../../components/ConfirmModal';
import './Admin.css';

const ADMIN_PRODUCTS_PER_PAGE = 20;

type DeletedFilter = 'active' | 'deleted' | 'all';

function canHardDelete(deletedAt: string): boolean {
    const deletedDate = new Date(deletedAt);
    const eligibleDate = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return new Date() >= eligibleDate;
}

function hardDeleteEligibleDate(deletedAt: string): string {
    const deletedDate = new Date(deletedAt);
    const eligibleDate = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return eligibleDate.toLocaleDateString();
}

function AdminProducts() {
    const [products, setProducts] = useState<ProductWithImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>('active');
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'hardDelete'; id: string } | null>(null);
    const { token } = useContext(AuthContext);
    const { t } = useTranslation();
    const { showToast } = useToast();

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        const getProducts = async () => {
            try {
                setLoading(true);
                setError(null);
                setActionId(null);
                const data = await api.getAdminProducts(token, {
                    include_deleted: deletedFilter,
                    page,
                    per_page: ADMIN_PRODUCTS_PER_PAGE,
                }, controller.signal);
                setTotalPages(data.total_pages ?? 1);
                setHasMore(page < (data.total_pages ?? 1));
                setProducts(data.items ?? []);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error('Failed to fetch products:', err);
                setError(t('admin.products.error'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        getProducts();
        return () => { controller.abort(); };
    }, [token, t, page, fetchTrigger, deletedFilter]);

    const handleTabChange = (filter: DeletedFilter) => {
        setDeletedFilter(filter);
        setPage(1);
    };

    const handleDeleteClick = (productId: string) => {
        if (!token || actionId) return;
        setConfirmAction({ type: 'delete', id: productId });
    };

    const handleHardDeleteClick = (productId: string) => {
        if (!token || actionId) return;
        setConfirmAction({ type: 'hardDelete', id: productId });
    };

    const handleConfirm = async () => {
        if (!confirmAction || !token) return;
        const { type, id } = confirmAction;
        setConfirmAction(null);
        try {
            setActionId(id);
            setActionError(null);
            if (type === 'delete') {
                await api.deleteProduct(id, token);
                showToast(t('admin.products.deleteSuccess'), 'success');
            } else {
                await api.hardDeleteProduct(id, token);
                showToast(t('admin.products.hardDeleteSuccess'), 'success');
            }
            if (products.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                setFetchTrigger(n => n + 1);
            }
        } catch (err) {
            console.error(`Failed to ${type} product:`, err);
            setActionError(t('admin.products.error'));
            setActionId(null);
        }
    };

    const handleRestore = async (productId: string) => {
        if (!token || actionId) return;
        try {
            setActionId(productId);
            setActionError(null);
            await api.restoreProduct(productId, token);
            showToast(t('admin.products.restoreSuccess'), 'success');
            setFetchTrigger(n => n + 1);
        } catch (err) {
            console.error('Failed to restore product:', err);
            setActionError(t('admin.products.error'));
            setActionId(null);
        }
    };

    return (
        <div className="admin-products-page">
            <div className="page-header">
                <div>
                    <h1>{t('admin.products.title')}</h1>
                    <p className="page-subtitle">{t('admin.products.subtitle')}</p>
                </div>
                <Link to="create" className="button button-primary">
                    {t('admin.products.createNew')}
                </Link>
            </div>

            <div className="admin-tabs" role="tablist" aria-label={t('admin.products.filterTabs')}>
                {(['active', 'deleted', 'all'] as DeletedFilter[]).map(filter => (
                    <button
                        key={filter}
                        role="tab"
                        aria-selected={deletedFilter === filter}
                        className={`admin-tab${deletedFilter === filter ? ' admin-tab-active' : ''}`}
                        onClick={() => handleTabChange(filter)}
                    >
                        {t(`admin.products.tabs.${filter}`)}
                    </button>
                ))}
            </div>

            {actionError && (
                <div className="message message-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{actionError}</span>
                    <button onClick={() => setActionError(null)} className="button button-small button-secondary" style={{ marginLeft: '1rem' }}>
                        {t('common.close')}
                    </button>
                </div>
            )}

            {error ? (
                <ErrorDisplay
                    error={error}
                    onRetry={() => setFetchTrigger(n => n + 1)}
                    retryLabel={t('admin.products.retry')}
                />
            ) : products.length === 0 && page === 1 && !loading ? (
                <div className="empty-state">
                    <div className="empty-state-icon products-icon"></div>
                    <h3>{t('admin.products.noProducts')}</h3>
                    <p>{t('admin.products.noProductsDescription')}</p>
                    {deletedFilter === 'active' && (
                        <Link to="create" className="button button-primary">{t('admin.products.createFirst')}</Link>
                    )}
                </div>
            ) : loading ? (
                <div className="products-table-container">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>{t('admin.products.product')}</th>
                                <th>{t('admin.products.type')}</th>
                                <th>{t('common.price')}</th>
                                <th>{t('admin.products.stock')}</th>
                                <th>{t('admin.products.status')}</th>
                                <th>{t('admin.products.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3, 4, 5].map(i => (
                                <tr key={i}>
                                    <td><span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '120px' }} /></td>
                                    <td><span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '80px' }} /></td>
                                    <td><span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '60px' }} /></td>
                                    <td><span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '40px' }} /></td>
                                    <td><span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '70px' }} /></td>
                                    <td><span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '100px' }} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <>
                <div className="products-table-container">
                    <div className="table-header">
                        <div className="table-info">
                            <span className="table-count">{products.length} {t('common.products')} ({t('common.page')} {page})</span>
                            <span className="table-total">{t('admin.dashboard.totalStock')}: {products.filter(p => !p.product.deleted_at).reduce((sum, pwi) => sum + pwi.product.bottle_count, 0)} {t('common.bottles')}</span>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="products-table">
                            <thead>
                                <tr>
                                    <th>{t('admin.products.product')}</th>
                                    <th>{t('admin.products.type')}</th>
                                    <th>{t('common.price')}</th>
                                    <th>{t('admin.products.stock')}</th>
                                    <th>{t('admin.products.status')}</th>
                                    <th>{t('admin.products.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(({ product, image }) => {
                                    const isDeleted = product.deleted_at !== null;
                                    return (
                                        <tr key={product.product_id} className={isDeleted ? 'product-row-deleted' : ''}>
                                            <td>
                                                <div className="product-cell">
                                                    {image && (
                                                        <img
                                                            src={getImageUrl(image.id)}
                                                            alt={product.product_name}
                                                            className="product-image"
                                                        />
                                                    )}
                                                    <div className="product-details">
                                                        <div className="product-name">{product.product_name}</div>
                                                        <div className="product-id">ID: {product.product_id}</div>
                                                        {isDeleted && (
                                                            <div className="deleted-badge">
                                                                {t('admin.products.deletedBadge')} — {t('admin.products.deletedOn')} {new Date(product.deleted_at!).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="product-type">{product.product_type}</span>
                                            </td>
                                            <td>
                                                <span className="product-price">
                                                    {toFixed(product.price)} EUR
                                                </span>
                                            </td>
                                            <td>
                                                <div className="stock-cell">
                                                    <span className="stock-count">{product.bottle_count}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {(() => {
                                                    const stockStatus = getStockStatus(product.bottle_count, 'admin', t);
                                                    return (
                                                        <span className={`status-badge ${stockStatus.cssClass}`}>
                                                            {stockStatus.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    {!isDeleted ? (
                                                        <>
                                                            <Link to={`${product.product_id}/edit`} className="button button-small button-secondary">
                                                                {t('admin.products.edit')}
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDeleteClick(product.product_id)}
                                                                className="button button-small button-danger"
                                                                disabled={actionId !== null}
                                                            >
                                                                {actionId === product.product_id ? t('common.loading') : t('admin.products.delete')}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleRestore(product.product_id)}
                                                                className="button button-small button-secondary"
                                                                disabled={actionId !== null}
                                                            >
                                                                {actionId === product.product_id ? t('common.loading') : t('admin.products.restore')}
                                                            </button>
                                                            <button
                                                                onClick={() => canHardDelete(product.deleted_at!) ? handleHardDeleteClick(product.product_id) : undefined}
                                                                className="button button-small button-danger"
                                                                disabled={actionId !== null || !canHardDelete(product.deleted_at!)}
                                                                title={
                                                                    canHardDelete(product.deleted_at!)
                                                                        ? undefined
                                                                        : t('admin.products.hardDeleteEligibleOn', { date: hardDeleteEligibleDate(product.deleted_at!) })
                                                                }
                                                            >
                                                                {actionId === product.product_id ? t('common.loading') : t('admin.products.hardDelete')}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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
            {confirmAction && (
                <ConfirmModal
                    title={t(confirmAction.type === 'hardDelete' ? 'confirm.hardDelete.title' : 'confirm.delete.title')}
                    message={t(confirmAction.type === 'hardDelete' ? 'confirm.hardDelete.message' : 'confirm.delete.message')}
                    confirmLabel={t(confirmAction.type === 'hardDelete' ? 'confirm.hardDelete.confirm' : 'confirm.delete.confirm')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmAction(null)}
                    variant="danger"
                />
            )}
        </div>
    );
}

export default AdminProducts;
