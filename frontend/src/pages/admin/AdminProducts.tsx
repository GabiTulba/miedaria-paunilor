import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { ProductWithImage } from '../../types'; // Import ProductWithImage
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { getAdminStockStatus } from '../../utils/stockAvailability';
import './Admin.css';

function AdminProducts() {
    const [products, setProducts] = useState<ProductWithImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { token } = useContext(AuthContext);

    useEffect(() => {
        const getProducts = async () => {
            try {
                setLoading(true);
                setError(null);
                const productsData = await api.getProducts();
                setProducts(productsData);
            } catch (error) {
                console.error("Failed to fetch products:", error);
                setError('Failed to load products. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        getProducts();
    }, []);
    
    const handleDelete = async (productId: string) => {
        if (token && window.confirm('Are you sure you want to delete this product?')) {
            try {
                await api.deleteProduct(productId, token);
                setProducts(products.filter(pwi => pwi.product.product_id !== productId)); // Access product_id correctly
            } catch (error) {
                console.error("Failed to delete product:", error);
                alert('Failed to delete product.');
            }
        }
    };

    return (
        <div className="admin-products-page">
            <div className="page-header">
                <div>
                    <h1>Manage Products</h1>
                    <p className="page-subtitle">View, edit, and delete your mead products</p>
                </div>
                <Link to="create" className="button button-primary">
                    Create New Product
                </Link>
            </div>
            
            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading products...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <div className="error-icon warning-icon"></div>
                    <p className="error-message">{error}</p>
                    <button onClick={() => window.location.reload()} className="button button-secondary">Retry</button>
                </div>
            ) : products.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon products-icon"></div>
                    <h3>No products yet</h3>
                    <p>Get started by creating your first mead product</p>
                    <Link to="create" className="button button-primary">Create First Product</Link>
                </div>
            ) : (
                <div className="products-table-container">
                    <div className="table-header">
                        <div className="table-info">
                            <span className="table-count">{products.length} products</span>
                            <span className="table-total">Total stock: {products.reduce((sum, pwi) => sum + pwi.product.bottle_count, 0)} bottles</span>
                        </div>
                    </div>
                    
                    <div className="table-responsive">
                        <table className="products-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Type</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(productWithImage => (
                                    <tr key={productWithImage.product.product_id}>
                                        <td>
                                            <div className="product-cell">
                                                {productWithImage.image && (
                                                    <img 
                                                        src={`/images/${productWithImage.image.id}`} 
                                                        alt={productWithImage.product.product_name}
                                                        className="product-image"
                                                    />
                                                )}
                                                <div className="product-details">
                                                    <div className="product-name">{productWithImage.product.product_name}</div>
                                                    <div className="product-id">ID: {productWithImage.product.product_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="product-type">{productWithImage.product.product_type}</span>
                                        </td>
                                        <td>
                                            <span className="product-price">€{productWithImage.product.price}</span>
                                        </td>
                                        <td>
                                            <div className="stock-cell">
                                                <span className="stock-count">{productWithImage.product.bottle_count}</span>
                                            </div>
                                        </td>
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
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`${productWithImage.product.product_id}/edit`} className="button button-small button-secondary">
                                                    Edit
                                                </Link>
                                                <button 
                                                    onClick={() => handleDelete(productWithImage.product.product_id)} 
                                                    className="button button-small button-danger"
                                                >
                                                    Delete
                                                </button>
                                            </div>
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

export default AdminProducts;
