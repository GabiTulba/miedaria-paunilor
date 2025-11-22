// src/components/ProductDetails.tsx
import Image from 'next/image';
import CollapsibleInfo from './CollapsibleInfo';

const ProductDetails = ({ product }: { product: any }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Image
          src={product.image}
          alt={product.name}
          width={600}
          height={600}
          className="rounded-lg shadow-md"
        />
      </div>
      <div className="md:col-span-2">
        <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
        <div className="mb-8">
          <p><strong>Bottle Size:</strong> {product.details.size}</p>
          <p><strong>Price:</strong> {product.details.price}</p>
          <p><strong>Availability:</strong> {product.details.availability}</p>
        </div>
        <CollapsibleInfo
          description={product.description}
          characteristics={product.characteristics}
          ingredients={product.ingredients}
        />
      </div>
    </div>
  );
};

export default ProductDetails;
