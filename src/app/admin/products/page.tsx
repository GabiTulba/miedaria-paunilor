'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getProducts() {
  const response = await fetch('/api/admin/products');
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  const data = await response.json();
  return data.products;
}

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
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const initialProducts = await getProducts();
        setProducts(initialProducts);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);



  const handleDelete = async (productId: number, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete product "${productName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/products/${productName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      setProducts(products.filter((product) => product.id !== productId));
      alert('Product deleted successfully!');
    } catch (err: any) {
      alert(`Error deleting product: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-10">Loading products...</div>;
  }

  if (error) {
    return <div className="container mx-auto py-10 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Link href="/admin/products/add" className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          Add Product
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Availability</th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-600 uppercase tracking-wider">Alcohol</th>
              <th className="px-6 py-3 border-b-2 border-gray-300"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product: Product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.name}</td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.price}</td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.size}ml</td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.availability}</td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">{product.alcohol}%</td>
                <td className="px-6 py-4 whitespace-no-wrap text-right border-b border-gray-500 text-sm leading-5 font-medium">
                  <Link href={`/admin/products/${product.product_name}/edit`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id, product.product_name)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
