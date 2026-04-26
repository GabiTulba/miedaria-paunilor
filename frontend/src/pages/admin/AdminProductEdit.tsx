import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Product, ProductFormData, ProductWithImage } from '../../types';
import ProductForm from './ProductForm';
import { errorMapping, errorMessageMapping } from './errorMappings';
import { useAdminImages } from '../../hooks/useAdminImages';

function AdminProductEdit() {
    const { productId } = useParams<{ productId: string }>();
    const [productWithImage, setProductWithImage] = useState<ProductWithImage | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const { images: availableImages, loading: imagesLoading, error: imagesError } = useAdminImages(token);
    const [productLoading, setProductLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!token || !productId) {
                setProductLoading(false);
                return;
            }
            setProductLoading(true);
            try {
                const fetchedProductWithImage = await api.getProductByIdAdmin(productId, token);
                setProductWithImage(fetchedProductWithImage);
            } catch (error: any) {
                console.error("Failed to fetch product:", error);
            } finally {
                setProductLoading(false);
            }
        };
        fetchProduct();
    }, [productId, token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setErrors({});

        const newErrors: Record<string, string> = {};

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
        if (productWithImage && productId) {
            try {
                setSubmitting(true);
                const productToUpdate: Product = productWithImage.product;
                await api.updateProduct(productId, productToUpdate, token);
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
            } finally {
                setSubmitting(false);
            }
        }
    };
	
    if (productLoading || imagesLoading) return <div className="loader">{t('common.loading')}</div>;
    if (imagesError) return <div className="error-message">{imagesError}</div>;
    if (!productWithImage) return <div className="error-message">Product not found.</div>;

    // Pass the product part of productWithImage to ProductForm
    const productToPassToForm: ProductFormData = {
        ...productWithImage.product,
        product_id: productWithImage.product.product_id, // Ensure product_id is present
    };

    return (
        <>
            {errors.form && <p className="error-message">{errors.form}</p>}
            <ProductForm
                product={productToPassToForm}
                setProduct={(updatedProduct: ProductFormData) => {
                    setProductWithImage((prev) =>
                        prev ? { ...prev, product: { ...prev.product, ...updatedProduct } } : null
                    );
                }}
                onSubmit={handleSubmit}
                submitText="Update Product"
                isEdit={true}
                errors={errors}
                availableImages={availableImages}
                submitting={submitting}
            />
        </>
    );
}

export default AdminProductEdit;
