import { Link } from 'react-router-dom';
import { ProductWithImage } from '../types';
import { getMeadTypeLabel, getSweetnessTypeLabel } from '../enums';
import './ProductCard.css'; // Assuming a CSS file for styling the card

interface ProductCardProps {
  productWithImage: ProductWithImage;
}

function ProductCard({ productWithImage }: ProductCardProps) {
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
                <span className="mead-type">{getMeadTypeLabel(productWithImage.product.product_type)}</span>
                <span className="separator">|</span>
                <span className="sweetness">{getSweetnessTypeLabel(productWithImage.product.sweetness)}</span>
                <span className="separator">|</span>
                <span className="abv">{productWithImage.product.abv}% ABV</span>
                <span className="separator">|</span>
                <span className="volume">{productWithImage.product.bottle_size}ml</span>
              </div>
             <p className="price">{productWithImage.product.price} €</p>
             {productWithImage.product.bottle_count === 0 ? (
               <p className="availability out-of-stock">Out of Stock</p>
             ) : productWithImage.product.bottle_count >= 24 ? (
               <p className="availability in-stock">In stock</p>
             ) : (
               <p className="availability low-stock">Only {productWithImage.product.bottle_count} left in stock</p>
             )}
           </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;