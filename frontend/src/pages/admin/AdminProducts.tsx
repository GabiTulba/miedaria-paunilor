import { useEffect, useState, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductWithImage } from '../../types';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { getStockStatus } from '../../utils/stockAvailability';
import { getImageUrl } from '../../lib/api';
import { toFixed } from '../../utils/numberUtils';
import Pagination from '../../components/Pagination';
import './Admin.css';

const ADMIN_PRODUCTS_PER_PAGE = 20;

function AdminProducts() {
    const [products, setProducts] = useState<ProductWithImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const { token } = useContext(AuthContext);
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;

    useEffect(() => {
        const getProducts = async () => {
            try {
                setLoading(true);
                setError(null);
                const productsData = await api.getProducts({ page, per_page: ADMIN_PRODUCTS_PER_PAGE, limit: ADMIN_PRODUCTS_PER_PAGE + 1 });
                setHasMore(productsData.length > ADMIN_PRODUCTS_PER_PAGE);
                setProducts(productsData.slice(0, ADMIN_PRODUCTS_PER_PAGE));
            } catch (error) {
                console.error("Failed to fetch products:", error);
                setError(t('admin.products.error'));
            } finally {
                setLoading(false);
            }
        };
        getProducts();
    }, [t, page, fetchTrigger]);

    const handleDelete = async (productId: string) => {
        if (!token || deletingId || !window.confirm(t('admin.products.deleteConfirm'))) return;
        try {
            setDeletingId(productId);
            await api.deleteProduct(productId, token);
            if (products.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                setFetchTrigger(n => n + 1);
            }
        } catch (error) {
            console.error("Failed to delete product:", error);
            alert(t('admin.products.error'));
        } finally {
            setDeletingId(null);
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
            
            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>{t('admin.products.loading')}</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <div className="error-icon warning-icon"></div>
                    <p className="error-message">{error}</p>
                    <button onClick={() => window.location.reload()} className="button button-secondary">{t('admin.products.retry')}</button>
                </div>
            ) : products.length === 0 && page === 1 ? (
                <div className="empty-state">
                    <div className="empty-state-icon products-icon"></div>
                    <h3>{t('admin.products.noProducts')}</h3>
                    <p>{t('admin.products.noProductsDescription')}</p>
                    <Link to="create" className="button button-primary">{t('admin.products.createFirst')}</Link>
                </div>
            ) : (
                <div className="products-table-container">
                    <div className="table-header">
                        <div className="table-info">
                            <span className="table-count">{products.length} {t('common.products')} ({t('common.page')} {page})</span>
                            <span className="table-total">{t('admin.dashboard.totalStock')}: {products.reduce((sum, pwi) => sum + pwi.product.bottle_count, 0)} {t('common.bottles')}</span>
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
                                {products.map(productWithImage => (
                                    <tr key={productWithImage.product.product_id}>
                                        <td>
                                            <div className="product-cell">
                                                 {productWithImage.image && (
                                                    <img 
                                                        src={getImageUrl(productWithImage.image.id)}
                                                        alt={currentLanguage === 'ro' && productWithImage.product.product_name_ro 
                                                            ? productWithImage.product.product_name_ro 
                                                            : productWithImage.product.product_name}
                                                        className="product-image"
                                                    />
                                                )}
                                                <div className="product-details">
                                                    <div className="product-name">
                                                        {currentLanguage === 'ro' && productWithImage.product.product_name_ro 
                                                            ? productWithImage.product.product_name_ro 
                                                            : productWithImage.product.product_name}
                                                    </div>
                                                    <div className="product-id">ID: {productWithImage.product.product_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="product-type">{productWithImage.product.product_type}</span>
                                        </td>
                                         <td>
                                             <span className="product-price">
                                                 {currentLanguage === 'ro' 
                                                     ? `${toFixed(productWithImage.product.price_ron)} ${t('common.ron')}`
                                                     : `€${toFixed(productWithImage.product.price)}`
                                                 }
                                             </span>
                                        </td>
                                        <td>
                                            <div className="stock-cell">
                                                <span className="stock-count">{productWithImage.product.bottle_count}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {(() => {
                                                const stockStatus = getStockStatus(productWithImage.product.bottle_count, 'admin', t);
                                                return (
                                                    <span className={`status-badge ${stockStatus.cssClass}`}>
                                                        {stockStatus.label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`${productWithImage.product.product_id}/edit`} className="button button-small button-secondary">
                                                    {t('admin.products.edit')}
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(productWithImage.product.product_id)}
                                                    className="button button-small button-danger"
                                                    disabled={deletingId === productWithImage.product.product_id}
                                                >
                                                    {deletingId === productWithImage.product.product_id ? t('common.loading') : t('admin.products.delete')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        page={page}
                        hasMore={hasMore}
                        onPrevPage={() => setPage(page - 1)}
                        onNextPage={() => setPage(page + 1)}
                    />
                </div>
            )}
        </div>
    );
}

export default AdminProducts;
