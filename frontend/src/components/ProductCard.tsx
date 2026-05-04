import { useState, useEffect } from 'react';
import { LocalizedLink } from './LocalizedLink';
import { useTranslation } from 'react-i18next';
import { LocalizedProductWithImage } from '../types';
import { getEnumLabel } from '../enums';
import { getStockStatus } from '../utils/stockAvailability';
import { toFixed } from '../utils/numberUtils';
import { getImageUrl, getImageSrcSet } from '../lib/api';

import './ProductCard.css';

interface ProductCardProps {
  productWithImage?: LocalizedProductWithImage;
  renderSkeleton?: boolean;
}

function ProductCard({ productWithImage, renderSkeleton }: ProductCardProps) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const imageId = productWithImage?.image?.id;
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [imageId]);

  if (renderSkeleton) {
    return (
      <div className="product-card">
        <div className="product-card-main">
          <div className="product-card-image">
            <div className="skeleton" style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="product-card-content">
            <div className="skeleton" style={{ height: '1.2em', marginBottom: '10px', width: '90%' }} />
            <div className="product-details">
              <div className="product-details-line">
                <span className="skeleton" style={{ height: '0.75em', width: '45%', marginRight: '8px' }} />
                <span className="skeleton" style={{ height: '0.75em', width: '35%' }} />
              </div>
              <div className="product-details-line">
                <span className="skeleton" style={{ height: '0.75em', width: '40%', marginRight: '8px' }} />
                <span className="skeleton" style={{ height: '0.75em', width: '25%' }} />
              </div>
            </div>
            <p className="price">
              <span className="skeleton" style={{ display: 'inline-block', height: '1.1em', width: '35%' }} />
            </p>
            <p className="availability">
              <span className="skeleton" style={{ display: 'inline-block', height: '0.85em', width: '55%' }} />
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!productWithImage) return null;

  const { product, image } = productWithImage;
  const stockStatus = getStockStatus(product.bottle_count, 'shop', t);

  return (
    <div className="product-card">
      <LocalizedLink to={`/shop/${product.product_id}`}>
        <div className="product-card-main">
          <div className="product-card-image">
            {image && !imgError ? (
              <>
                <img
                  src={getImageUrl(image.id, 640)}
                  srcSet={getImageSrcSet(image.id)}
                  sizes="(min-width: 768px) 350px, 100vw"
                  alt={product.product_name}
                  className="product-image"
                  width={640}
                  height={640}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                />
                {!imgLoaded && <div className="skeleton product-image-skeleton" />}
              </>
            ) : (
              <div className="placeholder-image">{t('admin.productForm.noImage')}</div>
            )}
          </div>
           <div className="product-card-content">
             <h3>{product.product_name}</h3>
                 <div className="product-details">
                   <div className="product-details-line">
                      <span className="mead-type">
                        {getEnumLabel(product.product_type, 'mead_type', t)}
                      </span>
                      <span className="separator">|</span>
                      <span className="sweetness">
                        {getEnumLabel(product.sweetness, 'sweetness', t)}
                      </span>
                   </div>
                    <div className="product-details-line">
                      <span className="abv">{product.abv}% {t('product.abv')}</span>
                      <span className="separator">|</span>
                      <span className="volume">{product.bottle_size}{t('common.milliliters')}</span>
                    </div>
                 </div>
              <p className="price">{toFixed(product.price)} {product.currency}</p>
             <p className={`availability ${stockStatus.cssClass}`}>{stockStatus.description}</p>
           </div>
        </div>
      </LocalizedLink>
    </div>
  );
}

export default ProductCard;
