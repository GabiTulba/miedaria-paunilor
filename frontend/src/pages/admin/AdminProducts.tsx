import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Admin.css';

function AdminProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const { token } = useContext(AuthContext);

    useEffect(() => {
        const getProducts = async () => {
            try {
                const productsData = await api.getProducts();
                setProducts(productsData);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            }
        };
        getProducts();
    }, []);
    
    const handleDelete = async (productId: string) => {
        if (token && window.confirm('Are you sure you want to delete this product?')) {
            try {
                await api.deleteProduct(productId, token);
                setProducts(products.filter(p => p.product_id !== productId));
            } catch (error) {
                console.error("Failed to delete product:", error);
                alert('Failed to delete product.');
            }
        }
    };

    return (
        <div className="admin-products-page">
            <div className="page-header">
                <h1>Manage Products</h1>
                <Link to="create" className="button">Create New Product</Link>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Product Name</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map(product => (
                        <tr key={product.product_id}>
                            <td>{product.product_name}</td>
                            <td>{product.price} €</td>
                            <td>{product.bottle_count}</td>
                            <td>
                                <Link to={`${product.product_id}/edit`} className="button button-secondary">Edit</Link>
                                <button onClick={() => handleDelete(product.product_id)} className="button" style={{marginLeft: '10px', backgroundColor: 'var(--error-color)'}}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AdminProducts;
