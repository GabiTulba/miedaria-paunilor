import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductWithImage } from '../types';
import { getEnumLabel } from '../enums';
import { getStockStatus } from '../utils/stockAvailability';
import { toFixed } from '../utils/numberUtils';
import { getImageUrl } from '../lib/api';

import './ProductCard.css';

interface ProductCardProps {
  productWithImage: ProductWithImage;
}

function ProductCard({ productWithImage }: ProductCardProps) {
  const { t, i18n } = useTranslation();

  const stockStatus = getStockStatus(productWithImage.product.bottle_count, 'shop', t);
  const currentLanguage = i18n.language;
  
  // Get product name based on language
  const productName = currentLanguage === 'ro' && productWithImage.product.product_name_ro 
    ? productWithImage.product.product_name_ro 
    : productWithImage.product.product_name;
  
  return (
    <div className="product-card">
      <Link to={`/shop/${productWithImage.product.product_id}`}>
        <div className="product-card-main">
          <div className="product-card-image">
            {productWithImage.image ? (
              <img 
                src={getImageUrl(productWithImage.image.id)}
                alt={productName} 
                className="product-image" 
              />
            ) : (
              <div className="placeholder-image">{t('admin.productForm.noImage')}</div>
            )}
          </div>
           <div className="product-card-content">
             <h3>{productName}</h3>
                 <div className="product-details">
                   <div className="product-details-line">
                      <span className="mead-type">
                        {getEnumLabel(productWithImage.product.product_type, 'mead_type', t)}
                      </span>
                      <span className="separator">|</span>
                      <span className="sweetness">
                        {getEnumLabel(productWithImage.product.sweetness, 'sweetness', t)}
                      </span>
                   </div>
                    <div className="product-details-line">
                      <span className="abv">{productWithImage.product.abv}% {t('product.abv')}</span>
                      <span className="separator">|</span>
                      <span className="volume">{productWithImage.product.bottle_size}{t('common.milliliters')}</span>
                    </div>
                 </div>
              <p className="price">
                {currentLanguage === 'ro' 
                  ? `${toFixed(productWithImage.product.price_ron)} ${t('common.ron')}`
                  : `${toFixed(productWithImage.product.price)} ${t('common.euro')}`
                }
              </p>
             <p className={`availability ${stockStatus.cssClass}`}>{stockStatus.description}</p>
           </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;