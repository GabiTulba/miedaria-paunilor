import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product } from '../../types';
import ProductForm from './ProductForm';

function AdminProductEdit() {
    const { productId } = useParams<{ productId: string }>();
    const [product, setProduct] = useState<Product | null>(null);
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
        if (token && product && productId) {
            try {
                await api.updateProduct(productId, product, token);
                navigate('/admin/dashboard/products');
            } catch (error) {
                console.error("Failed to update product:", error);
                alert('Failed to update product. Check console for details.');
            }
        }
    };

    if (!product) return <div className="loader">Loading...</div>;

    return (
        <ProductForm
            product={product}
            setProduct={setProduct}
            onSubmit={handleSubmit}
            submitText="Update Product"
            isEdit={true}
        />
    );
}

export default AdminProductEdit;
