import { Product, Image } from '../../types';

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
                <label htmlFor="image_id">Product Image</label>
                <select
                    id="image_id"
                    name="image_id"
                    value={product.image_id || ''}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select an image</option>
                    {availableImages.map((image) => (
                        <option key={image.id} value={image.id}>
                            {image.file_name} (ID: {image.id.substring(0, 8)}...)
                        </option>
                    ))}
                </select>
                {selectedImage && (
                    <div style={{ marginTop: '10px' }}>
                        <img
                            src={`/images/${selectedImage.id}`}
                            alt={selectedImage.file_name}
                            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                        />
                    </div>
                )}
                {errors.image_id && <p className="error-message">{errors.image_id}</p>}
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
