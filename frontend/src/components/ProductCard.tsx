import { Link } from 'react-router-dom';
import { ProductWithImage } from '../types';
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
            <p className="price">{productWithImage.product.price} €</p>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;