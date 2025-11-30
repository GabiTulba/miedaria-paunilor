import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product } from '../../types';
import ProductForm from './ProductForm';
import { errorMapping, errorMessageMapping } from './errorMappings';

function AdminProductEdit() {
    const { productId } = useParams<{ productId: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                if (!productId) return;
                const productData = await api.getProductById(productId);
                setProduct(productData);
            } catch (error) {
                console.error("Failed to fetch product:", error);
            }
        };
        fetchProduct();
    }, [productId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors
        if (token && product && productId) {
            try {
                await api.updateProduct(productId, product, token);
                navigate('/admin/dashboard/products');
            } catch (error: any) {
                console.error("Failed to update product:", error);
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
                    alert('Failed to update product. Check console for details.');
                }
            }
        }
    };
	
    if (!product) return <div className="loader">Loading...</div>;

    return (
        <>
            {errors.form && <p className="error-message">{errors.form}</p>}
            <ProductForm
                product={product}
                setProduct={setProduct}
                onSubmit={handleSubmit}
                submitText="Update Product"
                isEdit={true}
                errors={errors}
            />
        </>
    );
}

export default AdminProductEdit;
