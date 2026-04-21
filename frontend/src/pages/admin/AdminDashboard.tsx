import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LocalizedProductWithImage } from '../../types';
import { api } from '../../lib/api';
import { getStockStatus } from '../../utils/stockAvailability';
import { getImageUrl } from '../../lib/api';
import { toFixed } from '../../utils/numberUtils';
import './Admin.css';

function AdminDashboard() {
    const [products, setProducts] = useState<LocalizedProductWithImage[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const productsData = await api.getProducts();
                setProducts(productsData);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, pwi) => sum + pwi.product.bottle_count, 0);
    const lowStockProducts = products.filter(pwi => {
        const stockStatus = getStockStatus(pwi.product.bottle_count, 'admin', t);
        return stockStatus.status === 'low_stock';
    }).length;
    const totalValue = products.reduce((sum, pwi) => {
        return sum + (Number(pwi.product.price) * pwi.product.bottle_count);
    }, 0);
    const valueCurrency = products.length > 0 ? products[0].product.currency : '';

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>{t('admin.dashboard.title')}</h1>
                <p className="dashboard-subtitle">{t('admin.dashboard.subtitle')}</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon products-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : totalProducts}</h3>
                        <p>{t('admin.dashboard.totalProducts')}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stock-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : totalStock}</h3>
                        <p>{t('admin.dashboard.totalStock')}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon warning-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : lowStockProducts}</h3>
                        <p>{t('admin.dashboard.lowStock')}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon value-icon"></div>
                    <div className="stat-content">
                         <h3>{loading ? '...' : `${totalValue.toFixed(2)} ${valueCurrency}`}</h3>
                        <p>{t('admin.dashboard.totalValue')}</p>
                    </div>
                </div>
            </div>

            <div className="quick-actions">
                <h2>{t('common.actions')}</h2>
                <div className="actions-grid">
                    <Link to="products/create" className="action-card">
                        <div className="action-icon add-icon"></div>
                        <div className="action-content">
                            <h3>{t('admin.products.createNew')}</h3>
                            <p>{t('admin.products.subtitle')}</p>
                        </div>
                    </Link>
                    <Link to="products" className="action-card">
                        <div className="action-icon edit-icon"></div>
                        <div className="action-content">
                            <h3>{t('admin.products.title')}</h3>
                            <p>{t('admin.products.subtitle')}</p>
                        </div>
                    </Link>
                    <Link to="images" className="action-card">
                        <div className="action-icon images-action-icon"></div>
                        <div className="action-content">
                            <h3>{t('admin.images.title')}</h3>
                            <p>{t('admin.images.subtitle')}</p>
                        </div>
                    </Link>
                    <Link to="blog/create" className="action-card">
                        <div className="action-icon blog-action-icon"></div>
                        <div className="action-content">
                            <h3>{t('admin.blog.createNew')}</h3>
                            <p>{t('admin.blog.subtitle')}</p>
                        </div>
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="loading-icon"></div>
                    <p>{t('common.loading')}</p>
                </div>
            ) : products.length > 0 && (
                <div className="recent-products">
                    <h2>{t('common.products')}</h2>
                    <div className="products-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('admin.products.product')}</th>
                                    <th>{t('common.price')}</th>
                                    <th>{t('admin.products.stock')}</th>
                                    <th>{t('admin.products.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.slice(0, 5).map(({ product, image }) => (
                                    <tr key={product.product_id}>
                                        <td>
                                            <div className="product-info">
                                                {image && (
                                                     <img
                                                        src={getImageUrl(image.id)}
                                                        alt={product.product_name}
                                                        className="product-thumbnail"
                                                    />
                                                )}
                                                <span>{product.product_name}</span>
                                            </div>
                                        </td>
                                         <td>{toFixed(product.price)} {product.currency}</td>
                                        <td>{product.bottle_count}</td>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
