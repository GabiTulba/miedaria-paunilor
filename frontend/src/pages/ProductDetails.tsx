import { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProductWithImage } from '../types'; // Import ProductWithImage
import { api } from '../lib/api';
import { CartContext } from '../context/CartContext';
import { 
    getMeadTypeLabel, 
    getSweetnessTypeLabel,
    getTurbidityTypeLabel,
    getEffervescenceTypeLabel,
    getAcidityTypeLabel,
    getTaninsTypeLabel,
    getBodyTypeLabel
} from '../enums';
import CollapsibleSection from '../components/CollapsibleSection';
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
                    
                    <div className="product-basic-info">
                        <div className="basic-info-item">
                            <span className="basic-info-label">Mead Type:</span>
                            <span className="basic-info-value">{getMeadTypeLabel(product.product_type)}</span>
                        </div>
                        <div className="basic-info-item">
                            <span className="basic-info-label">ABV:</span>
                            <span className="basic-info-value">{product.abv}%</span>
                        </div>
                        <div className="basic-info-item">
                            <span className="basic-info-label">Volume:</span>
                            <span className="basic-info-value">{product.bottle_size}ml</span>
                        </div>
                    </div>
                    
                    <p className="product-description">{product.product_description}</p>
                    
                    <CollapsibleSection title="Ingredients" defaultCollapsed={true}>
                        <p className="product-ingredients">{product.ingredients}</p>
                    </CollapsibleSection>
                    
                    <CollapsibleSection title="Details" defaultCollapsed={true}>
                        <div className="product-details-grid">
                            <div className="detail-item">
                                <span className="detail-label">Sweetness:</span>
                                <span className="detail-value">{getSweetnessTypeLabel(product.sweetness)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Turbidity:</span>
                                <span className="detail-value">{getTurbidityTypeLabel(product.turbidity)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Effervescence:</span>
                                <span className="detail-value">{getEffervescenceTypeLabel(product.effervescence)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Acidity:</span>
                                <span className="detail-value">{getAcidityTypeLabel(product.acidity)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Tanins:</span>
                                <span className="detail-value">{getTaninsTypeLabel(product.tanins)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Body:</span>
                                <span className="detail-value">{getBodyTypeLabel(product.body)}</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <div className="add-to-cart-section">
                        <div className="cart-availability-info">
                            <div className="availability-info">
                                <span className="availability-label">Availability:</span>
                                {product.bottle_count === 0 ? (
                                    <span className="availability-details out-of-stock-details">Out of Stock</span>
                                ) : product.bottle_count >= 24 ? (
                                    <span className="availability-details in-stock-details">In stock</span>
                                ) : (
                                    <span className="availability-details low-stock-details">Only {product.bottle_count} left</span>
                                )}
                            </div>
                            <div className="cart-controls">
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
            </div>
        </div>
    );
}

export default ProductDetails;
