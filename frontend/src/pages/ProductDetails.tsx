import { useEffect, useState, useContext, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductWithImage } from '../types';
import { api } from '../lib/api';
import { CartContext } from '../context/CartContext';
import { getEnumLabel } from '../enums';
import { getStockStatus, isInStock } from '../utils/stockAvailability';
import { getImageUrl } from '../lib/api';
import { toFixed } from '../utils/numberUtils';
import CollapsibleSection from '../components/CollapsibleSection';

import './ProductDetails.css';

function ProductDetails() {
    const { productId } = useParams<{ productId: string }>();
    const [productWithImage, setProductWithImage] = useState<ProductWithImage | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addToCart } = useContext(CartContext);
    const { t, i18n } = useTranslation();


    useEffect(() => {
        const fetchProduct = async () => {
            setIsLoading(true);
            try {
                if (!productId) return;
                const data = await api.getProductById(productId);
                setProductWithImage(data);
            } catch (err) {
                setError(t('errors.serverError'));
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProduct();
    }, [productId, t]);

    const localized = useMemo(() => {
        if (!productWithImage) return null;
        const { product } = productWithImage;
        const isRo = i18n.language === 'ro';
        return {
            productName: isRo && product.product_name_ro ? product.product_name_ro : product.product_name,
            productDescription: isRo && product.product_description_ro ? product.product_description_ro : product.product_description,
            ingredients: isRo && product.ingredients_ro ? product.ingredients_ro : product.ingredients,
            price: isRo ? product.price_ron : product.price,
            currency: isRo ? t('common.ron') : t('common.euro'),
        };
    }, [i18n.language, productWithImage, t]);

    const handleAddToCart = () => {
        if (productWithImage?.product) {
            addToCart(productWithImage.product, quantity, productWithImage.product.bottle_count);
        }
    };

    if (isLoading) {
        return <div className="loader">{t('common.loading')}</div>;
    }

    if (error || !productWithImage) {
        return <div className="error-message">{error || t('errors.notFound')}</div>;
    }

    const { product, image } = productWithImage;
    const { productName, productDescription, ingredients, price, currency } = localized!;

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString(i18n.language, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    return (
        <div className="product-details-page">
            <div className="back-to-shop">
                <Link to="/shop">&larr; {t('common.back')} {t('navigation.shop')}</Link>
            </div>
            <div className="product-details-content">
                <div className="product-image-column">
                    {image ? (
                        <img 
                            src={getImageUrl(image.id)}
                            alt={productName} 
                            className="product-detail-image" 
                        />
                    ) : (
                        <div className="placeholder-image product-detail-image">{t('admin.productForm.noImage')}</div>
                    )}
                </div>
                <div className="product-info-section">
                    <h1>{productName}</h1>
                     <p className="price-large">{toFixed(price)} {currency}</p>
                    
                    <div className="product-basic-info">
                        <div className="basic-info-item">
                            <span className="basic-info-label">{t('product.productType')}:</span>
                            <span className="basic-info-value">
                                 {getEnumLabel(product.product_type, 'mead_type', t)}
                            </span>
                        </div>
                        <div className="basic-info-item">
                            <span className="basic-info-label">{t('product.abv')}:</span>
                            <span className="basic-info-value">{product.abv}%</span>
                        </div>
                        <div className="basic-info-item">
                            <span className="basic-info-label">{t('product.bottleSize')}:</span>
                            <span className="basic-info-value">{product.bottle_size}{t('common.milliliters')}</span>
                        </div>
                        <div className="basic-info-item">
                            <span className="basic-info-label">{t('product.bottlingDate')}:</span>
                            <span className="basic-info-value">{formatDate(product.bottling_date)}</span>
                        </div>
                        <div className="basic-info-item">
                            <span className="basic-info-label">{t('product.lotNumber')}:</span>
                            <span className="basic-info-value">{product.lot_number}</span>
                        </div>
                    </div>
                    
                    <p className="product-description">{productDescription}</p>
                    
                    <CollapsibleSection title={t('product.ingredients')} defaultCollapsed={true}>
                        <p className="product-ingredients">{ingredients}</p>
                    </CollapsibleSection>
                    
                    <CollapsibleSection title={t('common.details')} defaultCollapsed={true}>
                        <div className="product-details-grid">
                            <div className="detail-item">
                                <span className="detail-label">{t('product.sweetness')}:</span>
                                <span className="detail-value">
                                     {getEnumLabel(product.sweetness, 'sweetness', t)}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('product.turbidity')}:</span>
                                <span className="detail-value">
                                     {getEnumLabel(product.turbidity, 'turbidity', t)}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('product.effervescence')}:</span>
                                <span className="detail-value">
                                     {getEnumLabel(product.effervescence, 'effervescence', t)}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('product.acidity')}:</span>
                                <span className="detail-value">
                                     {getEnumLabel(product.acidity, 'acidity', t)}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('product.tannins')}:</span>
                                <span className="detail-value">
                                     {getEnumLabel(product.tannins, 'tannins', t)}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('product.body')}:</span>
                                <span className="detail-value">
                                     {getEnumLabel(product.body, 'body', t)}
                                </span>
                            </div>
                        </div>
                    </CollapsibleSection>

                     <div className="add-to-cart-section">
                         <div className="cart-availability-info">
                             <div className="availability-info">
                                  <span className="availability-label">{t('common.availability')}:</span>
                                 {(() => {
                                     const stockStatus = getStockStatus(product.bottle_count, 'product-details', t);
                                     return (
                                         <span className={`availability-details ${stockStatus.cssClass}`}>
                                             {stockStatus.description}
                                         </span>
                                     );
                                 })()}
                             </div>
                              <div className="cart-controls">
                                  <div className="quantity-selector">
                                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                                      <span>{quantity}</span>
                                      <button 
                                          onClick={() => setQuantity(Math.min(product.bottle_count, quantity + 1))}
                                          disabled={quantity >= product.bottle_count}
                                      >+</button>
                                  </div>
                                  <button 
                                      className="button add-to-cart-btn"
                                      onClick={handleAddToCart}
                                      disabled={!isInStock(product.bottle_count)}
                                  >
                                      {isInStock(product.bottle_count) ? t('product.addToCart') : t('common.outOfStock')}
                                  </button>
                              </div>
                              {quantity >= product.bottle_count && product.bottle_count > 0 && (
                                  <div className="max-quantity-message">
                                      {t('product.maxQuantityReached', { count: product.bottle_count })}
                                  </div>
                              )}
                         </div>
                     </div>
                </div>
            </div>
        </div>
    );
}

export default ProductDetails;
