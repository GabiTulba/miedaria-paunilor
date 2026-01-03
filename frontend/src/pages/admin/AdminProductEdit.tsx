import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product, Image, ProductWithImage } from '../../types';
import ProductForm from './ProductForm';
import { errorMapping, errorMessageMapping } from './errorMappings';

function AdminProductEdit() {
    const { productId } = useParams<{ productId: string }>();
    const [productWithImage, setProductWithImage] = useState<ProductWithImage | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [availableImages, setAvailableImages] = useState<Image[]>([]);
    const [imagesLoading, setImagesLoading] = useState<boolean>(true);
    const [imagesError, setImagesError] = useState<string>('');
    const [productLoading, setProductLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!token) {
                setImagesError(t('errors.unauthorized'));
                setImagesLoading(false);
                setProductLoading(false);
                return;
            }

            setImagesLoading(true);
            setImagesError('');
            setProductLoading(true);

            try {
                // Fetch images
                const fetchedImages = await api.getImages(token);
                setAvailableImages(fetchedImages);

                // Fetch product
                if (!productId) {
                    setProductLoading(false);
                    return;
                }
                const fetchedProductWithImage = await api.getProductById(productId); // Fetch ProductWithImage
                setProductWithImage(fetchedProductWithImage); // Set ProductWithImage
            } catch (error: any) {
                setImagesError(`Failed to fetch data: ${error.response?.data?.message || error.message}`);
                console.error("Failed to fetch product or images:", error);
            } finally {
                setImagesLoading(false);
                setProductLoading(false);
            }
        };
        fetchAllData();
    }, [productId, token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors
        
        // Client-side validation
        const newErrors: Record<string, string> = {};
        
        // Validate bottling_date format
        if (productWithImage && productWithImage.product.bottling_date) {
            const dateObj = new Date(productWithImage.product.bottling_date);
            if (isNaN(dateObj.getTime())) {
                newErrors.bottling_date = t('admin.productForm.validation.invalidBottlingDate');
            }
        } else {
            newErrors.bottling_date = t('admin.productForm.validation.invalidBottlingDate');
        }
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        
        if (!token) {
            alert(t('errors.unauthorized'));
            return;
        }
        if (productLoading || imagesLoading) {
            alert(t('common.loading'));
            return;
        }
        if (imagesError) {
            alert(t('admin.images.error'));
            return;
        }
        if (productWithImage && productId) { // Check productWithImage
            try {
                // Extract product data for update
                const productToUpdate: Product = productWithImage.product;
                await api.updateProduct(productId, productToUpdate, token); // Pass Product
                navigate('/admin/dashboard/products');
            } catch (error: any) {
                console.error("Failed to update product:", error);
                if (error.response && error.response.data && error.response.data.errors) {
                    const backendErrors: Record<string, string> = {};
                    error.response.data.errors.forEach((err: any) => {
                        const fieldName = errorMapping[err];
                        if (fieldName) {
                            backendErrors[fieldName] = errorMessageMapping[err];
                        }
                    });
                    setErrors(backendErrors);
                } else if (error.response && error.response.data && error.response.data.message) {
                    setErrors({ form: error.response.data.message });
                } else {
                    alert(t('admin.products.error'));
                }
            }
        }
    };
	
    if (productLoading || imagesLoading) return <div className="loader">{t('common.loading')}</div>;
    if (imagesError) return <div className="error-message">{imagesError}</div>;
    if (!productWithImage) return <div className="error-message">Product not found.</div>;

    // Pass the product part of productWithImage to ProductForm
    const productToPassToForm: Omit<Product, 'product_id'> & { product_id?: string } = {
        ...productWithImage.product,
        product_id: productWithImage.product.product_id, // Ensure product_id is present
    };

    return (
        <>
            {errors.form && <p className="error-message">{errors.form}</p>}
            <ProductForm
                product={productToPassToForm} // Pass the extracted product
                setProduct={(updatedProduct: Product) => {
                    // When ProductForm updates the product, update productWithImage accordingly
                    setProductWithImage((prev) => 
                        prev ? { ...prev, product: updatedProduct } : null
                    );
                }}
                onSubmit={handleSubmit}
                submitText="Update Product"
                isEdit={true}
                errors={errors}
                availableImages={availableImages}
            />
        </>
    );
}

export default AdminProductEdit;
