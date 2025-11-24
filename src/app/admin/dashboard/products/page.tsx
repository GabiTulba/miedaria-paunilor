import { query } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getProducts() {
  const products = await query({
    query: 'SELECT * FROM products',
  });
  return products;
}

export default async function ProductsPage() {
  const products: any = await getProducts();

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Link href="/admin/dashboard/products/add" className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          Add Product
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 border-b-2 border-gray-300"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product: any) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.name}</td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.price}</td>
                <td className="px-6 py-4 whitespace-no-wrap text-right border-b border-gray-500 text-sm leading-5 font-medium">
                  <Link href={`/admin/dashboard/products/${product.slug}/edit`} className="text-indigo-600 hover:text-indigo-900">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
