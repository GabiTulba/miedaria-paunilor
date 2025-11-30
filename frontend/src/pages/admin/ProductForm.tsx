import { Product } from '../../types';

interface ProductFormProps {
    product: Omit<Product, 'product_id'> & { product_id?: string };
    setProduct: (product: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitText: string;
    isEdit?: boolean;
    errors?: Record<string, string>;
}

function ProductForm({ product, setProduct, onSubmit, submitText, isEdit = false, errors = {} }: ProductFormProps) {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value === '' ? '' : Number(value) });
    };
    
    return (
        <form onSubmit={onSubmit} className="admin-product-form">
            <h1>{isEdit ? 'Edit Product' : 'Create New Product'}</h1>
            <div className="form-group">
                <label htmlFor="product_id">Product ID</label>
                <input
                    type="text"
                    id="product_id"
                    name="product_id"
                    value={product.product_id || ''}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                />
                {errors.product_id && <p className="error-message">{errors.product_id}</p>}
            </div>
            <div className="form-group">
                <label htmlFor="product_name">Product Name</label>
                <input
                    type="text"
                    id="product_name"
                    name="product_name"
                    value={product.product_name}
                    onChange={handleChange}
                    required
                />
                {errors.product_name && <p className="error-message">{errors.product_name}</p>}
            </div>
            <div className="form-group">
                <label htmlFor="product_description">Description</label>
                <textarea
                    id="product_description"
                    name="product_description"
                    value={product.product_description}
                    onChange={handleChange}
                    rows={5}
                    required
                />
                {errors.product_description && <p className="error-message">{errors.product_description}</p>}
            </div>
            <div className="form-group">
                <label htmlFor="image_url">Image URL</label>
                <input
                    type="text"
                    id="image_url"
                    name="image_url"
                    value={product.image_url || ''} // Use empty string for controlled component
                    onChange={handleChange}
                    required
                />
                {errors.image_url && <p className="error-message">{errors.image_url}</p>}
            </div>
            <div className="form-group">
                <label htmlFor="ingredients">Ingredients</label>
                <textarea
                    id="ingredients"
                    name="ingredients"
                    value={product.ingredients}
                    onChange={handleChange}
                    rows={3}
                    required
                />
                {errors.ingredients && <p className="error-message">{errors.ingredients}</p>}
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="abv">ABV (%)</label>
                    <input
                        type="number"
                        id="abv"
                        name="abv"
                        value={product.abv}
                        onChange={handleNumericChange}
                        required
                        step="0.1"
                    />
                    {errors.abv && <p className="error-message">{errors.abv}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="price">Price (€)</label>
                    <input
                        type="number"
                        id="price"
                        name="price"
                        value={product.price}
                        onChange={handleNumericChange}
                        required
                        step="0.01"
                    />
                    {errors.price && <p className="error-message">{errors.price}</p>}
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="bottle_count">Bottle Count</label>
                    <input
                        type="number"
                        id="bottle_count"
                        name="bottle_count"
                        value={product.bottle_count}
                        onChange={handleNumericChange}
                        required
                    />
                    {errors.bottle_count && <p className="error-message">{errors.bottle_count}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="bottle_size">Bottle Size (ml)</label>
                    <input
                        type="number"
                        id="bottle_size"
                        name="bottle_size"
                        value={product.bottle_size}
                        onChange={handleNumericChange}
                        required
                    />
                    {errors.bottle_size && <p className="error-message">{errors.bottle_size}</p>}
                </div>
            </div>
            <button type="submit" className="button">{submitText}</button>
        </form>
    );
}

export default ProductForm;
