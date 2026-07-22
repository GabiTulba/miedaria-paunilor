import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormProvider, useForm, type SubmitHandler } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import ProductForm from './ProductForm';
import { ProductFormData } from '../../types';
import { applyServerErrors, errorMapping, mapBackendValidationErrors } from './errorMappings';
import { getTodayIsoDate } from '../../utils/dateUtils';
import { useAdminImages } from '../../context/AdminImagesContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import ConfirmModal from '../../components/ConfirmModal';

const INITIAL_PRODUCT: ProductFormData = {
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
    tannins: '',
    body: '',
    abv: 0.0,
    bottle_count: 0,
    bottle_size: 750,
    price_ron: 0.00,
    image_id: '',
    bottling_date: '',
    lot_number: 1,
    energy_kj: 0.0,
    energy_kcal: 0.0,
    fat: 0.0,
    saturates: 0.0,
    carbohydrates: 0.0,
    sugars: 0.0,
    protein: 0.0,
    salt: 0.0,
};

function AdminProductCreate() {
    const [submitting, setSubmitting] = useState(false);
    const [saved, setSaved] = useState(false);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const { images: availableImages, loading: imagesLoading, error: imagesError } = useAdminImages();

    const methods = useForm<ProductFormData>({
        defaultValues: { ...INITIAL_PRODUCT, bottling_date: getTodayIsoDate() },
        mode: 'onBlur',
    });

    const blocker = useUnsavedChanges(methods.formState.isDirty && !saved);

    const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
        if (submitting) return;
        try {
            setSubmitting(true);
            await api.createProduct(data);
            showToast(t('admin.products.created'), 'success');
            // flushSync so the blocker sees isDirty=false before navigate()
            // fires the router transition (otherwise the unsaved-changes
            // modal pops on the post-save redirect).
            flushSync(() => setSaved(true));
            navigate('/admin/dashboard/products');
        } catch (error) {
            console.error("Failed to create product:", error);
            const backendErrors = mapBackendValidationErrors(error, errorMapping, t, 'product');
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            if (backendErrors) {
                applyServerErrors(methods.setError, backendErrors);
            } else if (message) {
                methods.setError('root.server', { message });
            } else {
                showToast('Failed to create product. Check console for details.', 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {imagesLoading ? (
                <p>Loading images...</p>
            ) : imagesError ? (
                <p className="error-message">{imagesError}</p>
            ) : (
                <FormProvider {...methods}>
                    <ProductForm
                        onSubmit={onSubmit}
                        submitText={t('admin.productForm.save')}
                        availableImages={availableImages}
                        submitting={submitting}
                    />
                </FormProvider>
            )}
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

export default AdminProductCreate;
