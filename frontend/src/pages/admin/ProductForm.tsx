import { Product } from '../../types';

interface ProductFormProps {
    product: Omit<Product, 'product_id'> & { product_id?: string };
    setProduct: (product: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitText: string;
    isEdit?: boolean;
}

function ProductForm({ product, setProduct, onSubmit, submitText, isEdit = false }: ProductFormProps) {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value === '' ? '' : parseInt(value, 10) });
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
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="abv">ABV (%)</label>
                    <input
                        type="text"
                        id="abv"
                        name="abv"
                        value={product.abv}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="price">Price (€)</label>
                    <input
                        type="text"
                        id="price"
                        name="price"
                        value={product.price}
                        onChange={handleChange}
                        required
                    />
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
                </div>
            </div>
            <button type="submit" className="button">{submitText}</button>
        </form>
    );
}

export default ProductForm;
