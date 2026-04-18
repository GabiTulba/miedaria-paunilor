import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocalizedProductWithImage } from '../types';
import { getEnumLabel } from '../enums';
import { getStockStatus } from '../utils/stockAvailability';
import { toFixed } from '../utils/numberUtils';
import { getImageUrl } from '../lib/api';

import './ProductCard.css';

interface ProductCardProps {
  productWithImage: LocalizedProductWithImage;
}

function ProductCard({ productWithImage }: ProductCardProps) {
  const { t } = useTranslation();

  const { product, image } = productWithImage;
  const stockStatus = getStockStatus(product.bottle_count, 'shop', t);

  return (
    <div className="product-card">
      <Link to={`/shop/${product.product_id}`}>
        <div className="product-card-main">
          <div className="product-card-image">
            {image ? (
              <img
                src={getImageUrl(image.id)}
                alt={product.product_name}
                className="product-image"
              />
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
      </Link>
    </div>
  );
}

export default ProductCard;
