import { Product, Image } from '../../types';
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value === '' ? 0 : Number(value) });
    };

    if (loading) {
        return <div>Loading enum values...</div>;
    }

    if (error) {
        return <div>Error loading enum values: {error}</div>;
    }

    if (!enums) {
        return <div>No enum values available</div>;
    }
    
    return (
        <form onSubmit={onSubmit} className="admin-product-form">
            <div className="form-header">
                <h1>{isEdit ? 'Edit Product' : 'Create New Product'}</h1>
                <p className="form-subtitle">Fill in the details for your mead product</p>
            </div>

            <div className="form-section">
                <h2 className="section-title">Basic Information</h2>
                <div className="section-content">
                    <TextInput
                        id="product_id"
                        name="product_id"
                        label="Product ID"
                        value={product.product_id || ''}
                        onChange={handleChange}
                        required
                        disabled={isEdit}
                        error={errors.product_id}
                        placeholder="e.g., classic-hidromel"
                        helpText="Lowercase letters, dashes, and underscores only"
                    />
                    <TextInput
                        id="product_name"
                        name="product_name"
                        label="Product Name"
                        value={product.product_name}
                        onChange={handleChange}
                        required
                        error={errors.product_name}
                        placeholder="e.g., Classic Hidromel"
                    />
                    <TextAreaInput
                        id="product_description"
                        name="product_description"
                        label="Description"
                        value={product.product_description}
                        onChange={handleChange}
                        rows={4}
                        required
                        error={errors.product_description}
                        placeholder="Describe your mead product..."
                    />
                    <TextAreaInput
                        id="ingredients"
                        name="ingredients"
                        label="Ingredients"
                        value={product.ingredients}
                        onChange={handleChange}
                        rows={3}
                        required
                        error={errors.ingredients}
                        placeholder="List the ingredients..."
                    />
                </div>
            </div>

            <div className="form-section">
                <h2 className="section-title">Product Image</h2>
                <div className="section-content">
                    <SelectInput
                        id="image_id"
                        name="image_id"
                        label="Product Image"
                        value={product.image_id || ''}
                        onChange={handleChange}
                        required
                        options={[
                            { value: '', label: 'Select an image' },
                            ...availableImages.map((image) => ({
                                value: image.id,
                                label: `${image.file_name} (ID: ${image.id.substring(0, 8)}...)`,
                            })),
                        ]}
                        error={errors.image_id}
                        helpText="Choose an image from your uploaded images"
                    />
                    {availableImages.length === 0 && (
                        <div className="form-alert">
                            <span className="alert-icon warning-icon"></span>
                            <div className="alert-content">
                                <p>No images available. Please upload images first.</p>
                                <a href="/admin/dashboard/images" className="alert-link">Go to Images</a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="form-section">
                <h2 className="section-title">Mead Characteristics</h2>
                <div className="section-content">
                    <div className="form-row">
                        <SelectInput
                            id="product_type"
                            name="product_type"
                            label="Mead Type"
                            value={product.product_type}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select mead type' },
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
                            label="Sweetness"
                            value={product.sweetness}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select sweetness' },
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
                            label="Turbidity"
                            value={product.turbidity}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select turbidity' },
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
                            label="Effervescence"
                            value={product.effervescence}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select effervescence' },
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
                            label="Acidity"
                            value={product.acidity}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select acidity' },
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
                            label="Tanins"
                            value={product.tanins}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select tanins' },
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
                            label="Body"
                            value={product.body}
                            onChange={handleChange}
                            options={[
                                { value: '', label: 'Select body' },
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
                <h2 className="section-title">Pricing & Inventory</h2>
                <div className="section-content">
                    <div className="form-row">
                        <NumberInput
                            id="abv"
                            name="abv"
                            label="ABV (%)"
                            value={product.abv}
                            onChange={handleNumericChange}
                            required
                            step="0.1"
                            min="0"
                            max="99.9"
                            error={errors.abv}
                            helpText="0.0 to 99.9%"
                        />
                        <NumberInput
                            id="price"
                            name="price"
                            label="Price (€)"
                            value={product.price}
                            onChange={handleNumericChange}
                            required
                            step="0.01"
                            min="0"
                            error={errors.price}
                            helpText="Price in Euros"
                        />
                    </div>
                    <div className="form-row">
                        <NumberInput
                            id="bottle_count"
                            name="bottle_count"
                            label="Bottle Count"
                            value={product.bottle_count}
                            onChange={handleNumericChange}
                            required
                            min="0"
                            error={errors.bottle_count}
                            helpText="Number of bottles in stock"
                        />
                        <NumberInput
                            id="bottle_size"
                            name="bottle_size"
                            label="Bottle Size (ml)"
                            value={product.bottle_size}
                            onChange={handleNumericChange}
                            required
                            min="1"
                            error={errors.bottle_size}
                            helpText="Volume in milliliters"
                        />
                    </div>
                </div>
            </div>

            <div className="form-actions">
                <button type="submit" className="button button-primary">
                    {submitText}
                </button>
                <a href="/admin/dashboard/products" className="button button-secondary">Cancel</a>
            </div>
        </form>
    );
}

export default ProductForm;
