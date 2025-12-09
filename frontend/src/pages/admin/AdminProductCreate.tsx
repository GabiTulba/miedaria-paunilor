import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import ProductForm from './ProductForm';
import { Product, Image } from '../../types';
import { errorMapping, errorMessageMapping } from './errorMappings';

function AdminProductCreate() {
    const [product, setProduct] = useState<Omit<Product, 'product_id'> & { product_id?: string }>({
        product_id: '',
        product_name: '',
        product_description: '',
        ingredients: '',
        product_type: '',
        sweetness: '',

        turbidity: '',
        effervescence: '',
        acidity: '',
        tanins: '',
        body: '',
        abv: '0.0',
        bottle_count: 0,
        bottle_size: 750,
        price: '0.00',
        image_id: '', // Use image_id instead of image_url
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    const [availableImages, setAvailableImages] = useState<Image[]>([]);
    const [imagesLoading, setImagesLoading] = useState<boolean>(true);
    const [imagesError, setImagesError] = useState<string>('');

    useEffect(() => {
        const fetchImages = async () => {
            if (!token) {
                setImagesError('Authentication token not found. Please log in.');
                setImagesLoading(false);
                return;
            }
            setImagesLoading(true);
            setImagesError('');
            try {
                const fetchedImages = await api.getImages(token);
                setAvailableImages(fetchedImages);
            } catch (error: any) {
                setImagesError(`Failed to fetch images: ${error.response?.data?.message || error.message}`);
            } finally {
                setImagesLoading(false);
            }
        };
        fetchImages();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors
        if (!token) {
            alert('Authentication token not found. Please log in.');
            return;
        }
        if (imagesLoading) {
            alert('Images are still loading. Please wait.');
            return;
        }
        if (imagesError) {
            alert('Error loading images. Cannot create product.');
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
