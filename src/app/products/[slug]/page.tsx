// src/app/products/[slug]/page.tsx
import ProductDetails from '@/components/ProductDetails';
import { products } from '@/lib/products';
import Link from 'next/link';

const ProductPage = ({ params }: { params: { slug: string } }) => {
  const product = products.find((p) => p.slug === params.slug);

  if (!product) {
    return <div>Product not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <Link
        href="/shop"
        className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800 mb-4 inline-block"
      >
        &larr; Back to Shop
      </Link>
      <ProductDetails product={product} />
    </div>
  );
};

export default ProductPage;

