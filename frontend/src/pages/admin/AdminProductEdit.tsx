import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { Product, ProductFormData } from '../../types';
import type { LotNutrition } from '../../types/generated/LotNutrition';
import ProductForm from './ProductForm';
import { errorMapping, mapBackendValidationErrors } from './errorMappings';
import { useAdminImages } from '../../hooks/useAdminImages';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import ConfirmModal from '../../components/ConfirmModal';

// Fallback for legacy products saved before lots existed (no nutrition row yet).
const NUTRITION_DEFAULTS: LotNutrition = {
    energy_kj: 0,
    energy_kcal: 0,
    fat: 0,
    saturates: 0,
    carbohydrates: 0,
    sugars: 0,
    protein: 0,
    salt: 0,
};

function AdminProductEdit() {
    const { productId } = useParams<{ productId: string }>();
    const [product, setProduct] = useState<(Product & LotNutrition) | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showToast } = useToast();

    const { images: availableImages, loading: imagesLoading, error: imagesError } = useAdminImages();
    const [productLoading, setProductLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState(false);
    const [savedRef, setSavedRef] = useState(false);
    const initialSnapshotRef = useRef<string | null>(null);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) {
                setProductLoading(false);
                return;
            }
            setProductLoading(true);
            try {
                const detail = await api.getProductByIdAdmin(productId);
                const flatProduct = { ...detail.product, ...(detail.nutrition ?? NUTRITION_DEFAULTS) };
                setProduct(flatProduct);
                initialSnapshotRef.current = JSON.stringify(flatProduct);
            } catch (error: any) {
                console.error("Failed to fetch product:", error);
            } finally {
                setProductLoading(false);
            }
        };
        fetchProduct();
    }, [productId]);

    const isDirty = !savedRef
        && !!product
        && initialSnapshotRef.current !== null
        && JSON.stringify(product) !== initialSnapshotRef.current;
    const blocker = useUnsavedChanges(isDirty);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setErrors({});

        const newErrors: Record<string, string> = {};

        if (product && product.bottling_date) {
            const dateObj = new Date(product.bottling_date);
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

        if (productLoading || imagesLoading) {
            showToast(t('common.loading'), 'error');
            return;
        }
        if (imagesError) {
            showToast(t('admin.images.error'), 'error');
            return;
        }
        if (product && productId) {
            try {
                setSubmitting(true);
                await api.updateProduct(productId, product);
                showToast(t('admin.products.updated'), 'success');
                // flushSync so the blocker sees isDirty=false before navigate()
                // fires the router transition (otherwise the unsaved-changes
                // modal pops on the post-save redirect).
                flushSync(() => setSavedRef(true));
                navigate('/admin/dashboard/products');
            } catch (error: any) {
                console.error("Failed to update product:", error);
                const backendErrors = mapBackendValidationErrors(error, errorMapping, t, 'product');
                if (backendErrors) {
                    setErrors(backendErrors);
                } else if (error.response?.data?.message) {
                    setErrors({ form: error.response.data.message });
                } else {
                    showToast(t('admin.products.error'), 'error');
                }
            } finally {
                setSubmitting(false);
            }
        }
    };
	
    if (productLoading || imagesLoading) return <div className="loader">{t('common.loading')}</div>;
    if (imagesError) return <div className="error-message">{imagesError}</div>;
    if (!product) return <div className="error-message">Product not found.</div>;

    return (
        <>
            {errors.form && <p className="error-message">{errors.form}</p>}
            <ProductForm
                product={product}
                setProduct={(updatedProduct: ProductFormData) => {
                    setProduct((prev) =>
                        prev ? ({ ...prev, ...updatedProduct } as typeof prev) : null
                    );
                }}
                onSubmit={handleSubmit}
                submitText={t('admin.productForm.update')}
                isEdit={true}
                errors={errors}
                availableImages={availableImages}
                submitting={submitting}
            />
            {blocker.state === 'blocked' && (
                <ConfirmModal
                    title={t('admin.unsavedChanges.title')}
                    message={t('admin.unsavedChanges.message')}
                    confirmLabel={t('admin.unsavedChanges.discard')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={() => blocker.proceed?.()}
                    onCancel={() => blocker.reset?.()}
                    variant="warning"
                />
            )}
        </>
    );
}

export default AdminProductEdit;
