// src/components/ProductDetails.tsx
import Image from 'next/image';

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
        <p className="text-2xl font-semibold text-gray-800 mb-4">€{product.price}</p>
        <p className="text-gray-700">{product.description}</p>
      </div>
    </div>
  );
};

export default ProductDetails;
