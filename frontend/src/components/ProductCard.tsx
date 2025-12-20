import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductWithImage } from '../types';
import { formatEnumLabel } from '../enums';
import { getShopStockStatus } from '../utils/stockAvailability';
import { toFixed } from '../utils/numberUtils';
import './ProductCard.css';

interface ProductCardProps {
  productWithImage: ProductWithImage;
}

function ProductCard({ productWithImage }: ProductCardProps) {
  const { t } = useTranslation();
  const stockStatus = getShopStockStatus(productWithImage.product.bottle_count, t);
  
  return (
    <div className="product-card">
      <Link to={`/shop/${productWithImage.product.product_id}`}>
        <div className="product-card-main">
          <div className="product-card-image">
            {productWithImage.image ? (
              <img 
                src={`/images/${productWithImage.image.id}`} 
                alt={productWithImage.product.product_name} 
                className="product-image" 
              />
            ) : (
              <div className="placeholder-image">{t('admin.productForm.noImage')}</div>
            )}
          </div>
           <div className="product-card-content">
             <h3>{productWithImage.product.product_name}</h3>
                <div className="product-details">
                  <div className="product-details-line">
                    <span className="mead-type">{formatEnumLabel(productWithImage.product.product_type)}</span>
                    <span className="separator">|</span>
                    <span className="sweetness">{formatEnumLabel(productWithImage.product.sweetness)}</span>
                  </div>
                  <div className="product-details-line">
                    <span className="abv">{productWithImage.product.abv}% {t('product.abv')}</span>
                    <span className="separator">|</span>
                    <span className="volume">{productWithImage.product.bottle_size}{t('common.milliliters')}</span>
                  </div>
                </div>
              <p className="price">{toFixed(productWithImage.product.price)} {t('common.euro')}</p>
             <p className={`availability ${stockStatus.cssClass}`}>{stockStatus.description}</p>
           </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;