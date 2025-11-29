import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { AuthContext } from '../../context/AuthContext';
import { fetchWithAuth } from '../../lib/api';

function AdminProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const { token } = useContext(AuthContext);

    useEffect(() => {
        if (token) {
            const getProducts = async () => {
                try {
                    // Public endpoint, but we can use it here
                    const data = await fetch(`${import.meta.env.VITE_API_URL}/api/products`);
                    const productsData = await data.json();
                    setProducts(productsData);
                } catch (error) {
                    console.error("Failed to fetch products:", error);
                }
            };
            getProducts();
        }
    }, [token]);
    
    const handleDelete = async (productId: string) => {
        if (token && window.confirm('Are you sure you want to delete this product?')) {
            try {
                await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/admin/products/${productId}`, token, {
                    method: 'DELETE',
                });
                setProducts(products.filter(p => p.product_id !== productId));
            } catch (error) {
                console.error("Failed to delete product:", error);
            }
        }
    };

    return (
        <div>
            <h3>Products</h3>
            <Link to="/admin/dashboard/products/create">Create New Product</Link>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
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
                                <Link to={`/admin/dashboard/products/${product.product_id}/edit`}>Edit</Link>
                                <button onClick={() => handleDelete(product.product_id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AdminProducts;
