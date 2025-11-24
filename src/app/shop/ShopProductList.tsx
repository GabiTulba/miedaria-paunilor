import Image from 'next/image';
import { query } from '@/lib/db';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  slug: string;
}

async function getProducts() {
  const products = await query({
    query: 'SELECT * FROM products',
  });
  return products as Product[];
}

const ShopProductList = async () => {
  const products = await getProducts();

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Our Meads</h2>

        <div className="mt-6 space-y-8">
          {products.map((product) => (
            <Link key={product.slug} href={`/products/${product.slug}`} className="block hover:bg-gray-100 rounded-lg">
              <div className="flex flex-col md:flex-row items-start md:items-center bg-gray-50 p-4 rounded-lg shadow-sm">
                <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-6">
                  <div className="w-48 h-48 relative">
                    <Image
                      src={product.image}
                      alt={product.name}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md"
                    />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 text-center md:text-left">{product.name}</h3>
                </div>
                <div className="flex-grow">
                  <h4 className="font-medium text-gray-700">Details</h4>
                  <ul className="mt-2 list-disc list-inside text-gray-600 space-y-1">
                    <li>Price: €{product.price}</li>
                  </ul>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShopProductList;