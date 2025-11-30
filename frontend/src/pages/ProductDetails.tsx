import { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProductWithImage } from '../types'; // Import ProductWithImage
import { api } from '../lib/api';
import { CartContext } from '../context/CartContext';
import './ProductDetails.css';

function ProductDetails() {
    const { productId } = useParams<{ productId: string }>();
    const [productWithImage, setProductWithImage] = useState<ProductWithImage | null>(null); // Change type here
    const [quantity, setQuantity] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addToCart } = useContext(CartContext);

    useEffect(() => {
        const fetchProduct = async () => {
            setIsLoading(true);
            try {
                if (!productId) return;
                const data = await api.getProductById(productId);
                setProductWithImage(data);
            } catch (err) {
                setError('Failed to fetch product details.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProduct();
    }, [productId]);

    const handleAddToCart = () => {
        if (productWithImage?.product) { // Access product from productWithImage
            addToCart(productWithImage.product, quantity);
        }
    };

    if (isLoading) {
        return <div className="loader">Loading...</div>;
    }

    if (error || !productWithImage) {
        return <div className="error-message">{error || 'Product not found.'}</div>;
    }

    const { product, image } = productWithImage;

    return (
        <div className="product-details-page">
            <div className="back-to-shop">
                <Link to="/shop">&larr; Back to Shop</Link>
            </div>
            <div className="product-details-content">
                {image ? (
                    <img 
                        src={`/images/${image.id}`} 
                        alt={product.product_name} 
                        className="product-detail-image" 
                    />
                ) : (
                    <div className="placeholder-image product-detail-image">No Image</div>
                )}
                <div className="product-info-section">
                    <h1>{product.product_name}</h1>
                    <p className="price-large">{product.price} €</p>
                    <p className="product-description">{product.product_description}</p>
                    
                    <div className="product-meta">
                        <p><strong>ABV:</strong> {product.abv}%</p>
                        <p><strong>Volume:</strong> {product.bottle_size}ml</p>
                        <p><strong>Ingredients:</strong> {product.ingredients}</p>
                        <p><strong>Availability:</strong> {product.bottle_count > 0 ? `${product.bottle_count} in stock` : 'Out of stock'}</p>
                    </div>

                    <div className="add-to-cart-section">
                        <div className="quantity-selector">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                            <span>{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)}>+</button>
                        </div>
                        <button 
                            className="button add-to-cart-btn"
                            onClick={handleAddToCart}
                            disabled={product.bottle_count === 0}
                        >
                            {product.bottle_count > 0 ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProductDetails;
