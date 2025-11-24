'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddProductPage() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, price, description, image, slug }),
    });

    if (res.ok) {
      router.push('/admin/dashboard/products');
    } else {
      const data = await res.json();
      setError(data.message || 'An error occurred.');
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Add Product</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label className="block text-gray-700">Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Price</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Description</label>
          <textarea
            className="w-full px-3 py-2 border rounded-lg"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Image URL</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Slug</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-lg">
          Add Product
        </button>
      </form>
    </div>
  );
}
