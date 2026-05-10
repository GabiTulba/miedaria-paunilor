import { useCallback, useState } from 'react';
import { LocalizedLink } from './LocalizedLink';
import { useTranslation } from 'react-i18next';
import { LocalizedProductWithImage } from '../types';
import { getEnumLabel } from '../enums';
import { getStockStatus } from '../utils/stockAvailability';
import { toFixed } from '../utils/numberUtils';
import { getImageUrl, getImageSrcSet } from '../lib/api';
import { Skeleton } from './Skeleton';

import './ProductCard.css';

interface ProductCardProps {
  productWithImage?: LocalizedProductWithImage;
  renderSkeleton?: boolean;
}

function ProductCard({ productWithImage, renderSkeleton }: ProductCardProps) {
  const { t } = useTranslation();
  // The img is keyed on image.id below, so React unmounts/remounts on a new
  // image; that resets the state and avoids the previous "two parallel effects
  // re-checking `complete` every render" pattern.
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Cached images can be `complete` before onLoad attaches. Compute the initial
  // state from the element via a ref callback that runs as soon as the <img>
  // mounts; from then on, onLoad/onError carry it.
  const imgRefCallback = useCallback((img: HTMLImageElement | null) => {
    if (!img) return;
    if (img.complete) {
      if (img.naturalWidth > 0) setImgLoaded(true);
      else setImgError(true);
    }
  }, []);

  if (renderSkeleton) {
    return (
      <div className="product-card">
        <div className="product-card-main">
          <div className="product-card-image">
            <Skeleton w="100%" h="100%" />
          </div>
          <div className="product-card-content">
            <Skeleton h="1.2em" w="90%" style={{ marginBottom: '10px' }} />
            <div className="product-details">
              <div className="product-details-line">
                <Skeleton inline h="0.75em" w="45%" style={{ marginRight: '8px' }} />
                <Skeleton inline h="0.75em" w="35%" />
              </div>
              <div className="product-details-line">
                <Skeleton inline h="0.75em" w="40%" style={{ marginRight: '8px' }} />
                <Skeleton inline h="0.75em" w="25%" />
              </div>
            </div>
            <p className="price">
              <Skeleton inline h="1.1em" w="35%" />
            </p>
            <p className="availability">
              <Skeleton inline h="0.85em" w="55%" />
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
                  key={image.id}
                  ref={imgRefCallback}
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
                {!imgLoaded && <Skeleton className="product-image-skeleton" />}
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
