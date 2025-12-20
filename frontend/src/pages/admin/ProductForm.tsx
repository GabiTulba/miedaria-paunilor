import { Product, Image } from '../../types';
import { useTranslation } from 'react-i18next';
import TextInput from '../../components/forms/TextInput';
import TextAreaInput from '../../components/forms/TextAreaInput';
import NumberInput from '../../components/forms/NumberInput';
import SelectInput from '../../components/forms/SelectInput';
import { useFetchEnums } from '../../hooks/useFetchEnums';

interface ProductFormProps {
    product: Omit<Product, 'product_id'> & { product_id?: string };
    setProduct: (product: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitText: string;
    isEdit?: boolean;
    errors?: Record<string, string>;
    availableImages: Image[]; // New prop for available images
}

function ProductForm({ product, setProduct, onSubmit, submitText, isEdit = false, errors = {}, availableImages }: ProductFormProps) {
    const { enums, loading, error } = useFetchEnums();
    const { t } = useTranslation();

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
        <form onSubmit={onSubmit} className="admin-product-form">
            <div className="form-header">
                <h1>{isEdit ? t('admin.productForm.editTitle') : t('admin.productForm.createTitle')}</h1>
                <p className="form-subtitle">{t('admin.productForm.basicInfo')}</p>
            </div>

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
                    />
                    <TextInput
                        id="product_name"
                        name="product_name"
                        label={t('admin.productForm.productName')}
                        value={product.product_name}
                        onChange={handleChange}
                        required
                        error={errors.product_name}
                        placeholder="e.g., Classic Hidromel"
                    />
                    <TextAreaInput
                        id="product_description"
                        name="product_description"
                        label={t('admin.productForm.productDescription')}
                        value={product.product_description}
                        onChange={handleChange}
                        rows={4}
                        required
                        error={errors.product_description}
                        placeholder={t('admin.productForm.productDescription')}
                    />
                    <TextAreaInput
                        id="ingredients"
                        name="ingredients"
                        label={t('admin.productForm.ingredients')}
                        value={product.ingredients}
                        onChange={handleChange}
                        rows={3}
                        required
                        error={errors.ingredients}
                        placeholder={t('admin.productForm.ingredients')}
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
                        required
                        options={[
                            { value: '', label: t('admin.productForm.selectImage') },
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
                                    label: enumValue.label,
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
                                    label: enumValue.label,
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
                                    label: enumValue.label,
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
                                    label: enumValue.label,
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
                                    label: enumValue.label,
                                })),
                            ]}
                            required
                            error={errors.acidity}
                        />
                        <SelectInput
                            id="tanins"
                            name="tanins"
                            label={t('admin.productForm.tanins')}
                            value={product.tanins}
                            onChange={handleChange}
                            options={[
                                { value: '', label: t('admin.productForm.tanins') },
                                ...enums.tanins.map((enumValue) => ({
                                    value: enumValue.value,
                                    label: enumValue.label,
                                })),
                            ]}
                            required
                            error={errors.tanins}
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
                                    label: enumValue.label,
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
                        />
                        <NumberInput
                            id="price"
                            name="price"
                            label={t('admin.productForm.price')}
                            value={product.price}
                            onChange={handleNumericChange}
                            required
                            step="0.01"
                            min="0"
                            error={errors.price}
                            helpText={t('admin.productForm.priceHelp')}
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
                        />
                    </div>
                </div>
            </div>

            <div className="form-actions">
                <button type="submit" className="button button-primary">
                    {submitText}
                </button>
                <a href="/admin/dashboard/products" className="button button-secondary">{t('admin.productForm.cancel')}</a>
            </div>
        </form>
    );
}

export default ProductForm;
