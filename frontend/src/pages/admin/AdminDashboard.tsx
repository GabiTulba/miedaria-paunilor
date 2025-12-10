import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ProductWithImage } from '../../types';
import { getAdminStockStatus } from '../../utils/stockAvailability';
import './Admin.css';

function AdminDashboard() {
    const [products, setProducts] = useState<ProductWithImage[]>([]);
    const [loading, setLoading] = useState(true);

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
        const stockStatus = getAdminStockStatus(pwi.product.bottle_count);
        return stockStatus.status === 'low_stock';
    }).length;
    const totalValue = products.reduce((sum, pwi) => sum + (Number(pwi.product.price) * pwi.product.bottle_count), 0);

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>Welcome, Admin!</h1>
                <p className="dashboard-subtitle">Manage your meadery shop efficiently</p>
            </div>
            
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon products-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : totalProducts}</h3>
                        <p>Total Products</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stock-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : totalStock}</h3>
                        <p>Total Stock</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon warning-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : lowStockProducts}</h3>
                        <p>Low Stock</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon value-icon"></div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : `€${totalValue.toFixed(2)}`}</h3>
                        <p>Inventory Value</p>
                    </div>
                </div>
            </div>

            <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="actions-grid">
                    <Link to="products/create" className="action-card">
                        <div className="action-icon add-icon"></div>
                        <div className="action-content">
                            <h3>Add New Product</h3>
                            <p>Create a new mead product</p>
                        </div>
                    </Link>
                    <Link to="products" className="action-card">
                        <div className="action-icon edit-icon"></div>
                        <div className="action-content">
                            <h3>Manage Products</h3>
                            <p>Edit or delete existing products</p>
                        </div>
                    </Link>
                    <Link to="images" className="action-card">
                        <div className="action-icon images-action-icon"></div>
                        <div className="action-content">
                            <h3>Manage Images</h3>
                            <p>Upload and organize product images</p>
                        </div>
                    </Link>
                </div>
            </div>

            {!loading && products.length > 0 && (
                <div className="recent-products">
                    <h2>Recent Products</h2>
                    <div className="products-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.slice(0, 5).map(productWithImage => (
                                    <tr key={productWithImage.product.product_id}>
                                        <td>
                                            <div className="product-info">
                                                {productWithImage.image && (
                                                    <img 
                                                        src={`/images/${productWithImage.image.id}`} 
                                                        alt={productWithImage.product.product_name}
                                                        className="product-thumbnail"
                                                    />
                                                )}
                                                <span>{productWithImage.product.product_name}</span>
                                            </div>
                                        </td>
                                        <td>€{productWithImage.product.price}</td>
                                        <td>{productWithImage.product.bottle_count}</td>
                                        <td>
                                            {(() => {
                                                const stockStatus = getAdminStockStatus(productWithImage.product.bottle_count);
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