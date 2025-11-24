import Image from 'next/image';
import { query } from '@/lib/db';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  product_name: string;
  description: string;
  image: string;
  size: number;
  price: number;
  availability: number;
  organoleptic: string;
  taste: string;
  smell: string;
  body: string;
  alcohol: number;
  ingredients: string;
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
            <Link key={product.product_name} href={`/products/${product.product_name}`} className="block hover:bg-gray-100 rounded-lg">
              <div className="flex flex-col md:flex-row items-start bg-gray-50 p-4 rounded-lg shadow-sm min-h-[200px] md:min-h-[250px]">
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
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 text-center md:text-left break-words">{product.name}</h3>
                </div>
                <div className="flex-grow flex flex-col justify-between h-full whitespace-normal">
                  <p className="text-gray-600 mb-2 break-words">{product.description}</p>
                  <div>
                    <p className="text-xl font-bold text-gray-800 mb-1">€{product.price}</p>
                    <p className={`text-lg font-bold ${product.availability > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.availability > 0 ? 'In Stock' : 'Out of Stock'}
                    </p>
                  </div>
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