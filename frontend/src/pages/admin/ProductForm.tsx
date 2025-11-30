import { Product, Image } from '../../types';
import TextInput from '../../components/forms/TextInput';
import TextAreaInput from '../../components/forms/TextAreaInput';
import NumberInput from '../../components/forms/NumberInput';
import SelectInput from '../../components/forms/SelectInput';

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value === '' ? '' : Number(value) });
    };

    const selectedImage = availableImages.find(img => img.id === product.image_id);
    
    return (
        <form onSubmit={onSubmit} className="admin-product-form">
            <h1>{isEdit ? 'Edit Product' : 'Create New Product'}</h1>
            <TextInput
                id="product_id"
                name="product_id"
                label="Product ID"
                value={product.product_id || ''}
                onChange={handleChange}
                required
                disabled={isEdit}
                error={errors.product_id}
            />
            <TextInput
                id="product_name"
                name="product_name"
                label="Product Name"
                value={product.product_name}
                onChange={handleChange}
                required
                error={errors.product_name}
            />
            <TextAreaInput
                id="product_description"
                name="product_description"
                label="Description"
                value={product.product_description}
                onChange={handleChange}
                rows={5}
                required
                error={errors.product_description}
            />
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
            />
            <div className="form-row">
                <NumberInput
                    id="abv"
                    name="abv"
                    label="ABV (%)"
                    value={product.abv}
                    onChange={handleNumericChange}
                    required
                    step="0.1"
                    error={errors.abv}
                />
                <NumberInput
                    id="price"
                    name="price"
                    label="Price (€)"
                    value={product.price}
                    onChange={handleNumericChange}
                    required
                    step="0.01"
                    error={errors.price}
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
                    error={errors.bottle_count}
                />
                <NumberInput
                    id="bottle_size"
                    name="bottle_size"
                    label="Bottle Size (ml)"
                    value={product.bottle_size}
                    onChange={handleNumericChange}
                    required
                    error={errors.bottle_size}
                />
            </div>
            <button type="submit" className="button">{submitText}</button>
        </form>
    );
}

export default ProductForm;
