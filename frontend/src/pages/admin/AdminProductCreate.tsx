import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import ProductForm from './ProductForm';
import { Product } from '../../types';
import { errorMapping, errorMessageMapping } from './errorMappings';

function AdminProductCreate() {
    const [product, setProduct] = useState<Omit<Product, 'product_id'> & { product_id?: string }>({
        product_id: '',
        product_name: '',
        product_description: '',
        ingredients: '',
        abv: '0.0',
        bottle_count: 0,
        bottle_size: 750,
        price: '0.00',
        image_url: '', // Initialize image_url
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors
        if (token) {
            try {
                await api.createProduct(product, token);
                navigate('/admin/dashboard/products');
            } catch (error: any) {
                console.error("Failed to create product:", error);
                if (error.response && error.response.data && error.response.data.errors) {
                    const newErrors: Record<string, string> = {};
                    error.response.data.errors.forEach((err: any) => {
                        const fieldName = errorMapping[err];
                        if (fieldName) {
                            newErrors[fieldName] = errorMessageMapping[err];
                        }
                    });
                    setErrors(newErrors);
                } else if (error.response && error.response.data && error.response.data.message) {
                    setErrors({ form: error.response.data.message });
                } else {
                    alert('Failed to create product. Check console for details.');
                }
            }
        }
    };

    return (
        <>
            {errors.form && <p className="error-message">{errors.form}</p>}
            <ProductForm
                product={product}
                setProduct={setProduct}
                onSubmit={handleSubmit}
                submitText="Create Product"
                errors={errors}
            />
        </>
    );
}

export default AdminProductCreate;
