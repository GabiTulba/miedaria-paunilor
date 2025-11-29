import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { fetchWithAuth } from '../../lib/api';

function AdminProductCreate() {
    const [product, setProduct] = useState({
        product_id: '',
        product_name: '',
        product_description: '',
        ingredients: '',
        abv: '0.0',
        bottle_count: 0,
        bottle_size: 0,
        price: '0.00',
    });
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProduct(prev => ({ ...prev, [name]: value }));
    };
    
    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProduct(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (token) {
            try {
                await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/admin/products`, token, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...product,
                        abv: Number(product.abv),
                        price: Number(product.price),
                        bottle_count: Number(product.bottle_count),
                        bottle_size: Number(product.bottle_size),
                    }),
                });
                navigate('/admin/dashboard/products');
            } catch (error) {
                console.error("Failed to create product:", error);
            }
        }
    };

    return (
        <div>
            <h3>Create Product</h3>
            <form onSubmit={handleSubmit}>
                <div><label>Product ID: <input type="text" name="product_id" value={product.product_id} onChange={handleChange} /></label></div>
                <div><label>Name: <input type="text" name="product_name" value={product.product_name} onChange={handleChange} /></label></div>
                <div><label>Description: <textarea name="product_description" value={product.product_description} onChange={handleChange} /></label></div>
                <div><label>Ingredients: <textarea name="ingredients" value={product.ingredients} onChange={handleChange} /></label></div>
                <div><label>ABV (%): <input type="text" name="abv" value={product.abv} onChange={handleChange} /></label></div>
                <div><label>Bottle Count: <input type="number" name="bottle_count" value={product.bottle_count} onChange={handleNumericChange} /></label></div>
                <div><label>Bottle Size (ml): <input type="number" name="bottle_size" value={product.bottle_size} onChange={handleNumericChange} /></label></div>
                <div><label>Price (€): <input type="text" name="price" value={product.price} onChange={handleChange} /></label></div>
                <button type="submit">Create</button>
            </form>
        </div>
    );
}

export default AdminProductCreate;
