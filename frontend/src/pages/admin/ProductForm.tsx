import { useRef, useContext } from 'react';
import { useFormContext, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, ProductFormData } from '../../types';
import { EnumContext } from '../../context/EnumContext';
import { useShakeOnError } from '../../hooks/useShakeOnError';
import BasicInfoSection from './productFormSections/BasicInfoSection';
import ImageSection from './productFormSections/ImageSection';
import CharacteristicsSection from './productFormSections/CharacteristicsSection';
import PricingSection from './productFormSections/PricingSection';
import NutritionSection from './productFormSections/NutritionSection';

interface ProductFormProps {
    onSubmit: SubmitHandler<ProductFormData>;
    submitText: string;
    isEdit?: boolean;
    availableImages: Image[];
    submitting?: boolean;
}

function ProductForm({ onSubmit, submitText, isEdit = false, availableImages, submitting = false }: ProductFormProps) {
    const { enums, loading, error } = useContext(EnumContext);
    const { t } = useTranslation();
    const formRef = useRef<HTMLFormElement>(null);
    const { handleSubmit, formState: { errors, submitCount } } = useFormContext<ProductFormData>();

    const formError = errors.root?.server?.message;
    const fieldErrorMessages = Object.entries(errors)
        .filter(([field]) => field !== 'root')
        .map(([, fieldError]) => fieldError?.message)
        .filter((message): message is string => typeof message === 'string');
    // Gate the shake on submitCount so plain blur-validation errors never trigger it.
    useShakeOnError(formRef, fieldErrorMessages.length > 0 || formError ? submitCount : 0);

    if (loading) {
        return <div>{t('common.loading')}</div>;
    }

    if (error) {
        return <div>{t('errors.serverError')}: {error}</div>;
    }

    if (!enums) {
        return <div>{t('errors.serverError')}</div>;
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="admin-product-form" ref={formRef}>
            <div className="form-header">
                <h1>{isEdit ? t('admin.productForm.editTitle') : t('admin.productForm.createTitle')}</h1>
                <p className="form-subtitle">{t('admin.productForm.basicInfo')}</p>
            </div>

            {formError && <p className="error-message">{formError}</p>}

            {submitCount > 0 && fieldErrorMessages.length > 0 && (
                <div className="validation-summary" role="alert">
                    <h4>{t('admin.productForm.validationErrors')}</h4>
                    <ul>
                        {fieldErrorMessages.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            <BasicInfoSection isEdit={isEdit} />
            <ImageSection availableImages={availableImages} />
            <CharacteristicsSection />
            <PricingSection />
            <NutritionSection />

            <div className="form-actions">
                <button type="submit" className="button button-primary" disabled={submitting}>
                    {submitting && <span className="button-spinner" aria-hidden="true" />}
                    {submitting ? t('common.loading') : submitText}
                </button>
                <a href="/admin/dashboard/products" className="button button-secondary">{t('admin.productForm.cancel')}</a>
            </div>
        </form>
    );
}

export default ProductForm;
