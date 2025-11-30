import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import ProductForm from './ProductForm';
import { Product } from '../../types';

function AdminProductCreate() {
    const [product, setProduct] = useState<Omit<Product, 'product_id'>>({
        product_name: '',
        product_description: '',
        ingredients: '',
        abv: '0.0',
        bottle_count: 0,
        bottle_size: 750,
        price: '0.00',
    });
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (token) {
            try {
                await api.createProduct(product, token);
                navigate('/admin/dashboard/products');
            } catch (error) {
                console.error("Failed to create product:", error);
                alert('Failed to create product. Check console for details.');
            }
        }
    };

    return (
        <ProductForm
            product={product}
            setProduct={setProduct}
            onSubmit={handleSubmit}
            submitText="Create Product"
        />
    );
}

export default AdminProductCreate;
