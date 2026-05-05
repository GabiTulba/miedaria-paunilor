import { useRef, useEffect } from 'react';
import { Image, ProductFormData } from '../../types';
import { useTranslation } from 'react-i18next';
import TextInput from '../../components/forms/TextInput';
import TextAreaInput from '../../components/forms/TextAreaInput';
import NumberInput from '../../components/forms/NumberInput';
import SelectInput from '../../components/forms/SelectInput';
import { useFetchEnums } from '../../hooks/useFetchEnums';
import { getEnumLabel } from '../../enums';
import { useLanguage } from '../../hooks/useLanguage';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { ro } from 'date-fns/locale/ro';
import { enUS } from 'date-fns/locale/en-US';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('en', enUS);
registerLocale('ro', ro);

function validateRequired(value: string, fieldName: string): string | undefined {
    if (!value.trim()) return `${fieldName} is required`;
    return undefined;
}

function validateProductId(value: string): string | undefined {
    if (!value.trim()) return 'Product ID is required';
    if (!/^[a-z0-9_-]+$/.test(value)) return 'Only lowercase letters, numbers, dashes, underscores';
    if (value.length > 128) return 'Max 128 characters';
    return undefined;
}

function validateAbv(value: string): string | undefined {
    const num = parseFloat(value);
    if (isNaN(num)) return 'ABV is required';
    if (num < 0 || num > 99.9) return 'ABV must be 0.0\u201399.9';
    return undefined;
}

function validatePositiveNumber(value: string, fieldName: string): string | undefined {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return `${fieldName} must be positive`;
    return undefined;
}

function validateNonNegative(value: string, fieldName: string): string | undefined {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return `${fieldName} must be non-negative`;
    return undefined;
}

interface ProductFormProps {
    product: ProductFormData;
    setProduct: (product: ProductFormData) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitText: string;
    isEdit?: boolean;
    errors?: Record<string, string>;
    availableImages: Image[];
    submitting?: boolean;
}

function ProductForm({ product, setProduct, onSubmit, submitText, isEdit = false, errors = {}, availableImages, submitting = false }: ProductFormProps) {
    const { enums, loading, error } = useFetchEnums();
    const { t } = useTranslation();
    const language = useLanguage();
    const formRef = useRef<HTMLFormElement>(null);

    const errorCount = Object.keys(errors).length;
    useEffect(() => {
        if (errorCount > 0 && formRef.current) {
            formRef.current.classList.add('shake');
            const form = formRef.current;
            const handler = () => form.classList.remove('shake');
            form.addEventListener('animationend', handler, { once: true });
            return () => form.removeEventListener('animationend', handler);
        }
    }, [errorCount]);
    
    // Convert bottling_date string to Date object for date picker
    const getDatePickerValue = () => {
        if (!product.bottling_date || product.bottling_date.trim() === '') {
            return null;
        }
        try {
            // The product.bottling_date is in YYYY-MM-DD format
            const [year, month, day] = product.bottling_date.split('-').map(Number);
            return new Date(year, month - 1, day); // month is 0-indexed in Date
        } catch (error) {
            console.error('Error parsing date:', error);
            return null;
        }
    };
    
    const handleDateChange = (date: Date | null) => {
        if (date) {
            // Convert Date object to YYYY-MM-DD format
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // month is 0-indexed
            const day = String(date.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            setProduct({ ...product, bottling_date: formattedDate });
        } else {
            setProduct({ ...product, bottling_date: '' });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value === '' ? 0 : Number(value) });
    };

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
        <form onSubmit={onSubmit} className="admin-product-form" ref={formRef}>
            <div className="form-header">
                <h1>{isEdit ? t('admin.productForm.editTitle') : t('admin.productForm.createTitle')}</h1>
                <p className="form-subtitle">{t('admin.productForm.basicInfo')}</p>
            </div>

            {Object.keys(errors).length > 0 && (
                <div className="validation-summary" role="alert">
                    <h4>{t('admin.productForm.validationErrors')}</h4>
                    <ul>
                        {Object.values(errors).filter(Boolean).map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="form-section">
                <h2 className="section-title">{t('admin.productForm.basicInfo')}</h2>
                <div className="section-content">
                    <TextInput
                        id="product_id"
                        name="product_id"
                        label={t('admin.productForm.productId')}
                        value={product.product_id || ''}
                        onChange={handleChange}
                        required
                        disabled={isEdit}
                        error={errors.product_id}
                        placeholder="e.g., classic-hidromel"
                        helpText={t('admin.productForm.productIdHelp')}
                        validate={(v) => validateProductId(v)}
                    />
                    <TextInput
                        id="product_name"
                        name="product_name"
                        label={t('admin.productForm.productName') + ' (EN)'}
                        value={product.product_name}
                        onChange={handleChange}
                        required
                        error={errors.product_name}
                        placeholder="e.g., Classic Hidromel"
                        validate={(v) => validateRequired(v, 'Product name')}
                    />
                    <TextInput
                        id="product_name_ro"
                        name="product_name_ro"
                        label={t('admin.productForm.productName') + ' (RO)'}
                        value={product.product_name_ro || ''}
                        onChange={handleChange}
                        required
                        error={errors.product_name_ro}
                        placeholder="e.g., Hidromel Clasic"
                        validate={(v) => validateRequired(v, 'Romanian product name')}
                    />
                    <TextAreaInput
                        id="product_description"
                        name="product_description"
                        label={t('admin.productForm.productDescription') + ' (EN)'}
                        value={product.product_description}
                        onChange={handleChange}
                        rows={4}
                        required
                        error={errors.product_description}
                        placeholder={t('admin.productForm.productDescription')}
                        validate={(v) => validateRequired(v, 'Description')}
                    />
                    <TextAreaInput
                        id="product_description_ro"
                        name="product_description_ro"
                        label={t('admin.productForm.productDescription') + ' (RO)'}
                        value={product.product_description_ro || ''}
                        onChange={handleChange}
                        rows={4}
                        required
                        error={errors.product_description_ro}
                        placeholder={t('admin.productForm.productDescription')}
                        validate={(v) => validateRequired(v, 'Romanian description')}
                    />
                    <TextAreaInput
                        id="ingredients"
                        name="ingredients"
                        label={t('admin.productForm.ingredients') + ' (EN)'}
                        value={product.ingredients}
                        onChange={handleChange}
                        rows={3}
                        required
                        error={errors.ingredients}
                        placeholder={t('admin.productForm.ingredients')}
                        validate={(v) => validateRequired(v, 'Ingredients')}
                    />
                    <TextAreaInput
                        id="ingredients_ro"
                        name="ingredients_ro"
                        label={t('admin.productForm.ingredients') + ' (RO)'}
                        value={product.ingredients_ro || ''}
                        onChange={handleChange}
                        rows={3}
                        required
                        error={errors.ingredients_ro}
                        placeholder={t('admin.productForm.ingredients')}
                        validate={(v) => validateRequired(v, 'Romanian ingredients')}
                    />
                </div>
            </div>

            <div className="form-section">
                <h2 className="section-title">{t('admin.productForm.image')}</h2>
                <div className="section-content">
                    <SelectInput
                        id="image_id"
                        name="image_id"
                        label={t('admin.productForm.selectImage')}
                        value={product.image_id || ''}
                        onChange={handleChange}
                        options={[
                            { value: '', label: t('admin.productForm.noImage') },
                            ...availableImages.map((image) => ({
                                value: image.id,
                                label: `${image.file_name} (ID: ${image.id.substring(0, 8)}...)`,
                            })),
                        ]}
                        error={errors.image_id}
                        helpText={t('admin.productForm.selectImage')}
                    />
                    {availableImages.length === 0 && (
                        <div className="form-alert">
                            <span className="alert-icon warning-icon"></span>
                            <div className="alert-content">
                                <p>{t('admin.productForm.noImage')}</p>
                                <a href="/admin/dashboard/images" className="alert-link">{t('navigation.images')}</a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="form-section">
                <h2 className="section-title">{t('admin.productForm.characteristics')}</h2>
                <div className="section-content">
                    <div className="form-row">
                        <SelectInput
                            id="product_type"
                            name="product_type"
                            label={t('admin.productForm.productType')}
                            value={product.product_type}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.productType') },
                                ...enums.mead_type.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'mead_type', t),
                                })),
                            ]}
                            required
                            error={errors.product_type}
                        />
                        <SelectInput
                            id="sweetness"
                            name="sweetness"
                            label={t('admin.productForm.sweetness')}
                            value={product.sweetness}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.sweetness') },
                                ...enums.sweetness.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'sweetness', t),
                                })),
                            ]}
                            required
                            error={errors.sweetness}
                        />
                    </div>
                    <div className="form-row">
                        <SelectInput
                            id="turbidity"
                            name="turbidity"
                            label={t('admin.productForm.turbidity')}
                            value={product.turbidity}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.turbidity') },
                                ...enums.turbidity.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'turbidity', t),
                                })),
                            ]}
                            required
                            error={errors.turbidity}
                        />
                        <SelectInput
                            id="effervescence"
                            name="effervescence"
                            label={t('admin.productForm.effervescence')}
                            value={product.effervescence}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.effervescence') },
                                ...enums.effervescence.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'effervescence', t),
                                })),
                            ]}
                            required
                            error={errors.effervescence}
                        />
                    </div>
                    <div className="form-row">
                        <SelectInput
                            id="acidity"
                            name="acidity"
                            label={t('admin.productForm.acidity')}
                            value={product.acidity}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.acidity') },
                                ...enums.acidity.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'acidity', t),
                                })),
                            ]}
                            required
                            error={errors.acidity}
                        />
                        <SelectInput
                            id="tannins"
                            name="tannins"
                            label={t('admin.productForm.tannins')}
                            value={product.tannins}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.tannins') },
                                ...enums.tannins.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'tannins', t),
                                })),
                            ]}
                            required
                            error={errors.tannins}
                        />
                    </div>
                    <div className="form-row">
                        <SelectInput
                            id="body"
                            name="body"
                            label={t('admin.productForm.body')}
                            value={product.body}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.body') },
                                ...enums.body.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: getEnumLabel(enumValue.value, 'body', t),
                                })),
                            ]}
                            required
                            error={errors.body}
                        />
                    </div>
                </div>
            </div>

            <div className="form-section">
                <h2 className="section-title">{t('admin.productForm.pricingInventory')}</h2>
                <div className="section-content">
                    <div className="form-row">
                        <NumberInput
                            id="abv"
                            name="abv"
                            label={t('admin.productForm.abv')}
                            value={product.abv}
                            onChange={handleNumericChange}
                            required
                            step="0.1"
                            min="0"
                            max="99.9"
                            error={errors.abv}
                            helpText={t('admin.productForm.abvHelp')}
                            validate={(v) => validateAbv(v)}
                        />
                        <NumberInput
                            id="price"
                            name="price"
                            label={t('admin.productForm.price') + ' (EUR)'}
                            value={product.price}
                            onChange={handleNumericChange}
                            required
                            step="0.01"
                            min="0"
                            error={errors.price}
                            helpText={t('admin.productForm.priceHelp')}
                            validate={(v) => validatePositiveNumber(v, 'Price')}
                        />
                    </div>
                    <div className="form-row">
                        <NumberInput
                            id="price_ron"
                            name="price_ron"
                            label={t('admin.productForm.price') + ' (RON)'}
                            value={product.price_ron || 0}
                            onChange={handleNumericChange}
                            required
                            step="0.01"
                            min="0"
                            error={errors.price_ron}
                            helpText={t('admin.productForm.priceRonHelp')}
                            validate={(v) => validatePositiveNumber(v, 'Price (RON)')}
                        />
                    </div>
                    <div className="form-row">
                        <NumberInput
                            id="bottle_count"
                            name="bottle_count"
                            label={t('admin.productForm.bottleCount')}
                            value={product.bottle_count}
                            onChange={handleNumericChange}
                            required
                            min="0"
                            error={errors.bottle_count}
                            helpText={t('admin.productForm.bottleCount')}
                            validate={(v) => validateNonNegative(v, 'Bottle count')}
                        />
                        <NumberInput
                            id="bottle_size"
                            name="bottle_size"
                            label={t('admin.productForm.bottleSize')}
                            value={product.bottle_size}
                            onChange={handleNumericChange}
                            required
                            min="1"
                            error={errors.bottle_size}
                            helpText={t('admin.productForm.bottleSizeHelp')}
                            validate={(v) => validatePositiveNumber(v, 'Bottle size')}
                        />
                    </div>
                     <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="bottling_date" className="form-label">
                                {t('admin.productForm.bottlingDate')}
                                <span className="required-indicator">*</span>
                            </label>
                            <DatePicker
                                id="bottling_date"
                                selected={getDatePickerValue()}
                                onChange={handleDateChange}
                                dateFormat="dd/MM/yyyy"
                                locale={language === 'ro' ? 'ro' : 'en'}
                                className={`form-input ${errors.bottling_date ? 'input-error' : ''}`}
                                placeholderText="DD/MM/YYYY"
                                isClearable
                                showYearDropdown
                                yearDropdownItemNumber={10}
                                scrollableYearDropdown
                                required
                            />
                            {errors.bottling_date && (
                                <div className="error-message">{errors.bottling_date}</div>
                            )}
                            <div className="help-text">{t('admin.productForm.bottlingDateHelp')}</div>
                        </div>
                        <NumberInput
                            id="lot_number"
                            name="lot_number"
                            label={t('admin.productForm.lotNumber')}
                            value={product.lot_number || 1}
                            onChange={handleNumericChange}
                            required
                            min="1"
                            error={errors.lot_number}
                            helpText={t('admin.productForm.lotNumberHelp')}
                            validate={(v) => validatePositiveNumber(v, 'Lot number')}
                        />
                    </div>
                </div>
            </div>

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
