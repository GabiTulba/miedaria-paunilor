import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { ProductWithImage } from '../../types'; // Import ProductWithImage
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Admin.css';

function AdminProducts() {
    const [products, setProducts] = useState<ProductWithImage[]>([]); // Change type here
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
                    {products.map(productWithImage => ( // Iterate over ProductWithImage
                        <tr key={productWithImage.product.product_id}>
                            <td>{productWithImage.product.product_name}</td>
                            <td>{productWithImage.product.price} €</td>
                            <td>{productWithImage.product.bottle_count}</td>
                            <td>
                                <Link to={`${productWithImage.product.product_id}/edit`} className="button button-secondary">Edit</Link>
                                <button onClick={() => handleDelete(productWithImage.product.product_id)} className="button" style={{marginLeft: '10px', backgroundColor: 'var(--error-color)'}}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AdminProducts;
