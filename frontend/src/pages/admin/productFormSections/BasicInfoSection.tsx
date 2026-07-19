import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProductFormData } from '../../../types';
import TextInput from '../../../components/forms/TextInput';
import TextAreaInput from '../../../components/forms/TextAreaInput';
import { validateRequired, validateProductId } from '../../../lib/validators';

interface BasicInfoSectionProps {
    isEdit: boolean;
}

function BasicInfoSection({ isEdit }: BasicInfoSectionProps) {
    const { t } = useTranslation();
    const { register, formState: { errors } } = useFormContext<ProductFormData>();

    return (
        <div className="form-section">
            <h2 className="section-title">{t('admin.productForm.basicInfo')}</h2>
            <div className="section-content">
                <TextInput
                    id="product_id"
                    label={t('admin.productForm.productId')}
                    required
                    disabled={isEdit}
                    error={errors.product_id?.message}
                    placeholder="e.g., classic-hidromel"
                    helpText={t('admin.productForm.productIdHelp')}
                    {...register('product_id', { validate: (v) => validateProductId(v ?? '') })}
                />
                <TextInput
                    id="product_name"
                    label={t('admin.productForm.productName') + ' (EN)'}
                    required
                    error={errors.product_name?.message}
                    placeholder="e.g., Classic Hidromel"
                    {...register('product_name', { validate: (v) => validateRequired(v, 'Product name') })}
                />
                <TextInput
                    id="product_name_ro"
                    label={t('admin.productForm.productName') + ' (RO)'}
                    required
                    error={errors.product_name_ro?.message}
                    placeholder="e.g., Hidromel Clasic"
                    {...register('product_name_ro', { validate: (v) => validateRequired(v, 'Romanian product name') })}
                />
                <TextAreaInput
                    id="product_description"
                    label={t('admin.productForm.productDescription') + ' (EN)'}
                    rows={4}
                    required
                    error={errors.product_description?.message}
                    placeholder={t('admin.productForm.productDescription')}
                    {...register('product_description', { validate: (v) => validateRequired(v, 'Description') })}
                />
                <TextAreaInput
                    id="product_description_ro"
                    label={t('admin.productForm.productDescription') + ' (RO)'}
                    rows={4}
                    required
                    error={errors.product_description_ro?.message}
                    placeholder={t('admin.productForm.productDescription')}
                    {...register('product_description_ro', { validate: (v) => validateRequired(v, 'Romanian description') })}
                />
                <TextAreaInput
                    id="ingredients"
                    label={t('admin.productForm.ingredients') + ' (EN)'}
                    rows={3}
                    required
                    error={errors.ingredients?.message}
                    placeholder={t('admin.productForm.ingredients')}
                    {...register('ingredients', { validate: (v) => validateRequired(v, 'Ingredients') })}
                />
                <TextAreaInput
                    id="ingredients_ro"
                    label={t('admin.productForm.ingredients') + ' (RO)'}
                    rows={3}
                    required
                    error={errors.ingredients_ro?.message}
                    placeholder={t('admin.productForm.ingredients')}
                    {...register('ingredients_ro', { validate: (v) => validateRequired(v, 'Romanian ingredients') })}
                />
            </div>
        </div>
    );
}

export default BasicInfoSection;
