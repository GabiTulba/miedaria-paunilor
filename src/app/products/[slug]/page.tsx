// src/app/products/[slug]/page.tsx
import ProductDetails from '@/components/ProductDetails';
import { query } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getProduct(slug: string) {
  const products: any = await query({
    query: 'SELECT * FROM products WHERE slug = ?',
    values: [slug],
  });
  return products[0];
}

const ProductPage = async ({ params }: { params: { slug:string } }) => {
  const product = await getProduct(params.slug);

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

