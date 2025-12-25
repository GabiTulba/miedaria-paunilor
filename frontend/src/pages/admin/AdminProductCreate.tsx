import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import ProductForm from './ProductForm';
import { Product, Image } from '../../types';
import { errorMapping, errorMessageMapping } from './errorMappings';

function AdminProductCreate() {
    const [product, setProduct] = useState<Omit<Product, 'product_id'> & { product_id?: string }>({
        product_id: '',
        product_name: '',
        product_name_ro: '',
        product_description: '',
        product_description_ro: '',
        ingredients: '',
        ingredients_ro: '',
        product_type: '',
        sweetness: '',

        turbidity: '',
        effervescence: '',
        acidity: '',
        tanins: '',
        body: '',
        abv: 0.0,
        bottle_count: 0,
        bottle_size: 750,
        price: 0.00,
        price_ron: 0.00,
        image_id: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { token } = useContext(AuthContext);
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [availableImages, setAvailableImages] = useState<Image[]>([]);
    const [imagesLoading, setImagesLoading] = useState<boolean>(true);
    const [imagesError, setImagesError] = useState<string>('');

    useEffect(() => {
        const fetchImages = async () => {
            if (!token) {
                setImagesError(t('errors.unauthorized'));
                setImagesLoading(false);
                return;
            }
            setImagesLoading(true);
            setImagesError('');
            try {
                const fetchedImages = await api.getImages(token);
                setAvailableImages(fetchedImages);
            } catch (error: any) {
                setImagesError(t('admin.images.error'));
            } finally {
                setImagesLoading(false);
            }
        };
        fetchImages();
    }, [token, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        if (!token) {
            alert(t('errors.unauthorized'));
            return;
        }
        if (imagesLoading) {
            alert(t('common.loading'));
            return;
        }
        if (imagesError) {
            alert(t('admin.images.error'));
            return;
        }
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
    };

    return (
        <>
            {errors.form && <p className="error-message">{errors.form}</p>}
            {imagesLoading ? (
                <p>Loading images...</p>
            ) : imagesError ? (
                <p className="error-message">{imagesError}</p>
            ) : (
                <ProductForm
                    product={product}
                    setProduct={setProduct}
                    onSubmit={handleSubmit}
                    submitText="Create Product"
                    errors={errors}
                    availableImages={availableImages}
                />
            )}
        </>
    );
}

export default AdminProductCreate;
