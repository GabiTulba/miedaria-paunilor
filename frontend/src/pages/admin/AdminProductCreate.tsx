import { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import ProductForm from './ProductForm';
import { ProductFormData } from '../../types';
import { errorMapping, mapBackendValidationErrors } from './errorMappings';
import { getTodayIsoDate } from '../../utils/dateUtils';
import { useAdminImages } from '../../hooks/useAdminImages';
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
    price: 0.00,
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
    const initialRef = useRef<ProductFormData>({ ...INITIAL_PRODUCT, bottling_date: getTodayIsoDate() });
    const [product, setProduct] = useState<ProductFormData>(initialRef.current);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [savedRef, setSavedRef] = useState(false);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const { images: availableImages, loading: imagesLoading, error: imagesError } = useAdminImages();

    const isDirty = !savedRef && JSON.stringify(product) !== JSON.stringify(initialRef.current);
    const blocker = useUnsavedChanges(isDirty);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setErrors({});

        const newErrors: Record<string, string> = {};

        if (!product.bottling_date || product.bottling_date.trim() === '') {
            newErrors.bottling_date = t('admin.productForm.validation.invalidBottlingDate');
        } else {
            const dateObj = new Date(product.bottling_date);
            if (isNaN(dateObj.getTime())) {
                newErrors.bottling_date = t('admin.productForm.validation.invalidBottlingDate');
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (imagesLoading) {
            showToast(t('common.loading'), 'error');
            return;
        }
        if (imagesError) {
            showToast(t('admin.images.error'), 'error');
            return;
        }
        try {
            setSubmitting(true);
            await api.createProduct(product);
            showToast(t('admin.products.created'), 'success');
            // flushSync so the blocker sees isDirty=false before navigate()
            // fires the router transition (otherwise the unsaved-changes
            // modal pops on the post-save redirect).
            flushSync(() => setSavedRef(true));
            navigate('/admin/dashboard/products');
        } catch (error: any) {
            console.error("Failed to create product:", error);
            const backendErrors = mapBackendValidationErrors(error, errorMapping, t, 'product');
            if (backendErrors) {
                setErrors(backendErrors);
            } else if (error.response?.data?.message) {
                setErrors({ form: error.response.data.message });
            } else {
                showToast('Failed to create product. Check console for details.', 'error');
            }
        } finally {
            setSubmitting(false);
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
                    submitText={t('admin.productForm.save')}
                    errors={errors}
                    availableImages={availableImages}
                    submitting={submitting}
                />
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
