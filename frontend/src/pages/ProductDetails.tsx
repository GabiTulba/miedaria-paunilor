import { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocalizedProductWithImage } from '../types';
import { api } from '../lib/api';
import { CartContext } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { getEnumLabel } from '../enums';
import { getStockStatus, isInStock } from '../utils/stockAvailability';
import { getImageUrl } from '../lib/api';
import { toFixed } from '../utils/numberUtils';
import { useFormattedDate } from '../hooks/useFormattedDate';
import CollapsibleSection from '../components/CollapsibleSection';
import ErrorDisplay from '../components/ErrorDisplay';

import './ProductDetails.css';

function ProductDetails() {
    const { productId } = useParams<{ productId: string }>();
    const [productWithImage, setProductWithImage] = useState<LocalizedProductWithImage | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const { addToCart } = useContext(CartContext);
    const { showToast } = useToast();
    const { t, i18n } = useTranslation();
    const formatDate = useFormattedDate();

    useEffect(() => {
        const controller = new AbortController();
        const fetchProduct = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (!productId) return;
                const data = await api.getProductById(productId, controller.signal);
                setProductWithImage(data);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError(t('errors.serverError'));
                console.error(err);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        fetchProduct();
        return () => { controller.abort(); };
    }, [productId, i18n.language, fetchTrigger]);

    const handleAddToCart = () => {
        if (productWithImage?.product) {
            addToCart(productWithImage.product, quantity, productWithImage.product.bottle_count);
            showToast(t('cart.addedToCart'), 'success');
        }
    };

    if (isLoading) {
        return <div className="loader">{t('common.loading')}</div>;
    }

    if (error || !productWithImage) {
        return (
            <div className="product-details-page">
                <div className="back-to-shop">
                    <Link to="/shop">&larr; {t('common.back')} {t('navigation.shop')}</Link>
                </div>
                <ErrorDisplay
                    error={error || t('errors.notFound')}
                    onRetry={error ? () => setFetchTrigger(n => n + 1) : undefined}
                    retryLabel={t('common.retry')}
                />
            </div>
        );
    }

    const { product, image } = productWithImage;

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
                            alt={product.product_name}
                            className="product-detail-image"
                        />
                    ) : (
                        <div className="placeholder-image product-detail-image">{t('admin.productForm.noImage')}</div>
                    )}
                </div>
                <div className="product-info-section">
                    <h1>{product.product_name}</h1>
                     <p className="price-large">{toFixed(product.price)} {product.currency}</p>

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

                    <p className="product-description">{product.product_description}</p>

                    <CollapsibleSection title={t('product.ingredients')} defaultCollapsed={true}>
                        <p className="product-ingredients">{product.ingredients}</p>
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
