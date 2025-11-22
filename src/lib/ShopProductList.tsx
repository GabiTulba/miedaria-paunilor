import Image from 'next/image';
import { products } from '@/lib/products';

const ShopProductList = () => {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Our Meads</h2>

        <div className="mt-6 space-y-8">
          {products.map((product) => (
            <div key={product.slug} className="flex flex-col md:flex-row items-start md:items-center bg-gray-50 p-4 rounded-lg shadow-sm">
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
                  <li>Size: {product.details.size}</li>
                  <li>Price: {product.details.price}</li>
                  <li>Availability: <span className="font-semibold text-green-600">{product.details.availability}</span></li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShopProductList;