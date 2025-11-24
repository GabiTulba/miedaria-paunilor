// src/app/products/[product_name]/page.tsx
import ProductDetails from '@/components/ProductDetails';
import { query } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getProduct(product_name: string) {
  const products: any = await query({
    query: 'SELECT * FROM products WHERE product_name = ?',
    values: [product_name],
  });
  return products[0];
}

const ProductPage = async ({ params }: { params: { product_name:string } }) => {
  const product = await getProduct(params.product_name);

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

