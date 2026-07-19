import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormProvider, useForm, type SubmitHandler } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { Product, ProductFormData } from '../../types';
import type { LotNutrition } from '../../types/generated/LotNutrition';
import ProductForm from './ProductForm';
import { applyServerErrors, errorMapping, mapBackendValidationErrors } from './errorMappings';
import { useAdminImages } from '../../context/AdminImagesContext';
import { useFetch } from '../../hooks/useFetch';
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
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showToast } = useToast();

    const { images: availableImages, loading: imagesLoading, error: imagesError } = useAdminImages();
    const [submitting, setSubmitting] = useState(false);
    const [saved, setSaved] = useState(false);

    const { data: productDetail, loading: productLoading } = useFetch(
        (signal) => productId ? api.getProductByIdAdmin(productId, signal) : Promise.resolve(null),
        [productId],
    );

    // `values` (below) needs a referentially stable object, so derive it once per fetch.
    const product: (Product & LotNutrition) | null = useMemo(
        () => productDetail ? { ...productDetail.product, ...(productDetail.nutrition ?? NUTRITION_DEFAULTS) } : null,
        [productDetail],
    );

    // `values` re-initializes the form when the fetch lands; `product` is
    // referentially stable afterwards, so the form is not reset on re-renders.
    const methods = useForm<ProductFormData>({ mode: 'onBlur', values: product ?? undefined });

    const blocker = useUnsavedChanges(methods.formState.isDirty && !saved);

    const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
        if (submitting || !productId) return;
        try {
            setSubmitting(true);
            // product_id is disabled on edit, so merge it back from the route.
            await api.updateProduct(productId, { ...data, product_id: productId });
            showToast(t('admin.products.updated'), 'success');
            // flushSync so the blocker sees isDirty=false before navigate()
            // fires the router transition (otherwise the unsaved-changes
            // modal pops on the post-save redirect).
            flushSync(() => setSaved(true));
            navigate('/admin/dashboard/products');
        } catch (error) {
            console.error("Failed to update product:", error);
            const backendErrors = mapBackendValidationErrors(error, errorMapping, t, 'product');
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            if (backendErrors) {
                applyServerErrors(methods.setError, backendErrors);
            } else if (message) {
                methods.setError('root.server', { message });
            } else {
                showToast(t('admin.products.error'), 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (productLoading || imagesLoading) return <div className="loader">{t('common.loading')}</div>;
    if (imagesError) return <div className="error-message">{imagesError}</div>;
    if (!product) return <div className="error-message">Product not found.</div>;

    return (
        <>
            <FormProvider {...methods}>
                <ProductForm
                    onSubmit={onSubmit}
                    submitText={t('admin.productForm.update')}
                    isEdit={true}
                    availableImages={availableImages}
                    submitting={submitting}
                />
            </FormProvider>
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
