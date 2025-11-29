import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { fetchWithAuth } from '../../lib/api';
import { Product } from '../../types';

function AdminProductEdit() {
    const { productId } = useParams<{ productId: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const data = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${productId}`);
                const productData = await data.json();
                setProduct(productData);
            } catch (error) {
                console.error("Failed to fetch product:", error);
            }
        };
        fetchProduct();
    }, [productId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (product) {
            setProduct({ ...product, [name]: value });
        }
    };
    
    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (product) {
            setProduct({ ...product, [name]: parseInt(value, 10) || 0 });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (token && product) {
            try {
                await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/admin/products/${productId}`, token, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...product,
                        bottle_count: Number(product.bottle_count),
                        bottle_size: Number(product.bottle_size),
                    }),
                });
                navigate('/admin/dashboard/products');
            } catch (error) {
                console.error("Failed to update product:", error);
            }
        }
    };

    if (!product) return <div>Loading...</div>;

    return (
        <div>
            <h3>Edit Product</h3>
            <form onSubmit={handleSubmit}>
                <div><label>Product ID: <input type="text" name="product_id" value={product.product_id} onChange={handleChange} disabled /></label></div>
                <div><label>Name: <input type="text" name="product_name" value={product.product_name} onChange={handleChange} /></label></div>
                <div><label>Description: <textarea name="product_description" value={product.product_description} onChange={handleChange} /></label></div>
                <div><label>Ingredients: <textarea name="ingredients" value={product.ingredients} onChange={handleChange} /></label></div>
                <div><label>ABV (%): <input type="text" name="abv" value={product.abv} onChange={handleChange} /></label></div>
                <div><label>Bottle Count: <input type="number" name="bottle_count" value={product.bottle_count} onChange={handleNumericChange} /></label></div>
                <div><label>Bottle Size (ml): <input type="number" name="bottle_size" value={product.bottle_size} onChange={handleNumericChange} /></label></div>
                <div><label>Price (€): <input type="text" name="price" value={product.price} onChange={handleChange} /></label></div>
                <button type="submit">Update</button>
            </form>
        </div>
    );
}

export default AdminProductEdit;
