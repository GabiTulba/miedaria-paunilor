'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EditProductPage({ params }: { params: { product_name: string } }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [product_name, setproduct_name] = useState('');
  const [size, setSize] = useState('');
  const [availability, setAvailability] = useState('');
  const [organoleptic, setOrganoleptic] = useState('');
  const [taste, setTaste] = useState('');
  const [smell, setSmell] = useState('');
  const [body, setBody] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchProduct = async () => {
      const res = await fetch(`/api/admin/products/${params.product_name}`);
      if (res.ok) {
        const product = await res.json();
        setName(product.name);
        setPrice(product.price);
        setDescription(product.description);
        setImage(product.image);
        setproduct_name(product.product_name);
        setSize(product.size);
        setAvailability(product.availability);
        setOrganoleptic(product.organoleptic);
        setTaste(product.taste);
        setSmell(product.smell);
        setBody(product.body);
        setAlcohol(product.alcohol);
        setIngredients(product.ingredients);
      }
    };
    fetchProduct();
  }, [params.product_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch(`/api/admin/products/${params.product_name}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name, price: parseFloat(price), description, image, product_name, 
        size: parseInt(size), availability: parseInt(availability), 
        organoleptic, taste, smell, body, alcohol: parseFloat(alcohol), ingredients 
      }),
    });

    if (res.ok) {
      router.push('/admin/products');
    } else {
      const data = await res.json();
      setError(data.message || 'An error occurred.');
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Edit Product</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label className="block text-gray-700">Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Product Name (URL friendly)</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={product_name}
            onChange={(e) => setproduct_name(e.target.value)}
            required
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
          <label className="block text-gray-700">Price (€)</label>
          <input
            type="number"
            step="0.01"
            className="w-full px-3 py-2 border rounded-lg"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Size (ml)</label>
          <input
            type="number"
            className="w-full px-3 py-2 border rounded-lg"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Availability (bottles)</label>
          <input
            type="number"
            className="w-full px-3 py-2 border rounded-lg"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Organoleptic</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={organoleptic}
            onChange={(e) => setOrganoleptic(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Taste</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={taste}
            onChange={(e) => setTaste(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Smell</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={smell}
            onChange={(e) => setSmell(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Body</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Alcohol (% ABV)</label>
          <input
            type="number"
            step="0.01"
            className="w-full px-3 py-2 border rounded-lg"
            value={alcohol}
            onChange={(e) => setAlcohol(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Ingredients</label>
          <textarea
            className="w-full px-3 py-2 border rounded-lg"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </div>
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-lg">
          Update Product
        </button>
      </form>
    </div>
  );
}
