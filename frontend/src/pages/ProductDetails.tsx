import { useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { CartContext } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { getEnumLabel } from '../enums';
import { getStockStatus, isInStock } from '../utils/stockAvailability';
import { getImageUrl, getImageSrcSet } from '../lib/api';
import { toFixed } from '../utils/numberUtils';
import { useFormattedDate } from '../hooks/useFormattedDate';
import { useFetch } from '../hooks/useFetch';
import { usePulse } from '../hooks/usePulse';
import CollapsibleSection from '../components/CollapsibleSection';
import ErrorDisplay from '../components/ErrorDisplay';
import Breadcrumb from '../components/Breadcrumb';
import SEO from '../components/SEO';
import { useLanguage } from '../hooks/useLanguage';
import { getOrigin } from '../lib/origin';
import { buildProductLd, buildBreadcrumbLd } from '../lib/structuredData';
import { clamp } from '../lib/text';
import { Skeleton } from '../components/Skeleton';
import EurConversionNote from '../components/EurConversionNote';

import './ProductDetails.css';

function ProductDetails() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const [quantity, setQuantity] = useState(1);
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const { isPulsing, pulse } = usePulse();
    const { addToCart } = useContext(CartContext);
    const { showToast } = useToast();
    const { t, i18n } = useTranslation();
    const lang = useLanguage();
    const formatDate = useFormattedDate();

    const { data: productWithImage, loading: isLoading, error, refetch } = useFetch(
        signal => productId ? api.getProductById(productId, signal) : Promise.resolve(null as never),
        [productId, i18n.language],
    );

    const handleAddToCart = () => {
        if (productWithImage?.product) {
            addToCart(productWithImage.product, quantity, productWithImage.product.bottle_count);
            showToast(t('cart.addedToCart'), 'success');
            pulse('add-to-cart');
        }
    };

    const backLink = (
        <button onClick={() => navigate(-1)} className="back-link">&larr; {t('common.backToShop')}</button>
    );

    if (isLoading) {
        return (
            <div className="product-details-page">
                <div className="back-to-shop">{backLink}</div>
                <div className="product-details-content">
                    <div className="product-image-column">
                        <Skeleton w="100%" style={{ aspectRatio: '1/1', borderRadius: 'var(--radius-md)' }} />
                    </div>
                    <div className="product-info-section">
                        <Skeleton h="2em" w="80%" style={{ marginBottom: '0.75rem' }} />
                        <Skeleton h="1.5em" w="25%" style={{ marginBottom: '1.5rem' }} />
                        <div style={{ marginBottom: '1.5rem' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} style={{ display: 'flex', marginBottom: '0.5rem' }}>
                                    <Skeleton inline h="1em" w="100px" />
                                </div>
                            ))}
                        </div>
                        <Skeleton h="1em" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton h="1em" w="85%" style={{ marginBottom: '2rem' }} />
                        <Skeleton h="3em" style={{ marginBottom: '1.5rem' }} />
                        <Skeleton h="3em" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !productWithImage) {
        return (
            <div className="product-details-page">
                <div className="back-to-shop">{backLink}</div>
                <ErrorDisplay
                    error={error ? t('errors.serverError') : t('errors.notFound')}
                    onRetry={error ? refetch : undefined}
                    retryLabel={t('common.retry')}
                />
            </div>
        );
    }

    const { product, image } = productWithImage;

    const origin = getOrigin();
    const pagePath = `/${lang}/shop/${product.product_id}`;
    const pageUrl = `${origin}${pagePath}`;
    const productImageUrl = image ? `${origin}${getImageUrl(image.id, 1024)}` : null;
    const seoDescription = clamp(product.product_description, 160);
    const productLd = buildProductLd({
        product,
        imageUrl: productImageUrl,
        pageUrl,
    });
    const breadcrumbLd = buildBreadcrumbLd(
        [
            { name: t('navigation.home'), url: `/${lang}` },
            { name: t('navigation.shop'), url: `/${lang}/shop` },
            { name: product.product_name, url: pagePath },
        ],
        origin
    );

    return (
        <div className="product-details-page">
            <SEO
                title={product.product_name}
                description={seoDescription}
                image={productImageUrl ?? undefined}
                type="product"
                structuredData={[productLd, breadcrumbLd]}
            />
            <Breadcrumb items={[
                { label: t('navigation.home'), to: '/' },
                { label: t('navigation.shop'), to: '/shop' },
                { label: product.product_name },
            ]} />
            <div className="back-to-shop">{backLink}</div>
            <div className="product-details-content">
                <div className="product-image-column">
                    {image && !imgError ? (
                        <div className={`product-detail-image-wrapper${imgLoaded ? ' is-loaded' : ''}`}>
                            <img
                                src={getImageUrl(image.id, 1024)}
                                srcSet={getImageSrcSet(image.id)}
                                sizes="(min-width: 992px) 500px, 100vw"
                                alt={product.product_name}
                                className="product-detail-image"
                                width={1024}
                                height={1024}
                                loading="eager"
                                fetchPriority="high"
                                decoding="async"
                                onLoad={() => setImgLoaded(true)}
                                onError={() => setImgError(true)}
                            />
                            {!imgLoaded && <Skeleton className="product-detail-image-skeleton" />}
                        </div>
                    ) : (
                        <div className="placeholder-image product-detail-image">{t('admin.productForm.noImage')}</div>
                    )}
                </div>
                <div className="product-info-section">
                    <h1>{product.product_name}</h1>
                     <p className="price-large">{toFixed(product.price)} {product.currency}{product.is_converted ? '*' : ''}</p>
                    <EurConversionNote products={[product]} />

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
                                      <button
                                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                          aria-label={t('product.decreaseQuantity')}
                                          disabled={quantity <= 1}
                                      >-</button>
                                      <input
                                          type="number"
                                          className="quantity-input"
                                          value={quantity}
                                          min={1}
                                          max={Math.min(99, product.bottle_count)}
                                          aria-label={t('product.quantity')}
                                          onChange={(e) => {
                                              const val = parseInt(e.target.value, 10);
                                              if (!isNaN(val) && val >= 1 && val < 100) {
                                                  setQuantity(Math.min(val, product.bottle_count));
                                              } else if (e.target.value === '') {
                                                  setQuantity(1);
                                              }
                                          }}
                                      />
                                      <button
                                          onClick={() => setQuantity(Math.min(product.bottle_count, quantity + 1))}
                                          disabled={quantity >= product.bottle_count}
                                          aria-label={t('product.increaseQuantity')}
                                      >+</button>
                                  </div>
                                  <button
                                      className={`button add-to-cart-btn${isPulsing('add-to-cart') ? ' success-pulse' : ''}`}
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
