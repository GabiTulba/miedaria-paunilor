import Image from 'next/image';
import Link from 'next/link';
import { query } from '@/lib/db';

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  product_name: string;
}

async function getProducts() {
  const products = await query({
    query: 'SELECT * FROM products',
  });
  return products as Product[];
}

const ProductList = async ({ limit }: { limit?: number }) => {
  const products = await getProducts();
  const productsToShow = limit ? products.slice(0, limit) : products;

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">Our Meads</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {productsToShow.map((product) => (
            <Link key={product.product_name} href={`/products/${product.product_name}`}>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={300}
                  height={400}
                  className="w-full h-64 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                  <p className="text-gray-600">{product.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductList;
