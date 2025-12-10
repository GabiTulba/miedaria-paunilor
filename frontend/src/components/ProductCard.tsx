import { Link } from 'react-router-dom';
import { ProductWithImage } from '../types';
import { formatEnumLabel } from '../enums';
import { getShopStockStatus } from '../utils/stockAvailability';
import './ProductCard.css'; // Assuming a CSS file for styling the card

interface ProductCardProps {
  productWithImage: ProductWithImage;
}

function ProductCard({ productWithImage }: ProductCardProps) {
  const stockStatus = getShopStockStatus(productWithImage.product.bottle_count);
  
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
              <div className="placeholder-image">No Image</div>
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
                    <span className="abv">{productWithImage.product.abv}% ABV</span>
                    <span className="separator">|</span>
                    <span className="volume">{productWithImage.product.bottle_size}ml</span>
                  </div>
                </div>
             <p className="price">{productWithImage.product.price} €</p>
             <p className={`availability ${stockStatus.cssClass}`}>{stockStatus.description}</p>
           </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;