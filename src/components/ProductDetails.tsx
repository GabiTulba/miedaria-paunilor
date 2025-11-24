'use client';
// src/components/ProductDetails.tsx
import Image from 'next/image';
import { useState } from 'react';

const ProductDetails = ({ product }: { product: any }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [characteristicsOpen, setCharacteristicsOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Image
          src={product.image}
          alt={product.name}
          width={600}
          height={600}
          className="rounded-lg shadow-md"
        />
      </div>
      <div className="md:col-span-2">
        <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
        <p className="text-2xl font-semibold text-gray-800 mb-4">€{product.price}</p>
        <p className="text-gray-700 mb-4">{product.description}</p>

        {/* Product Details Section */}
        <div className="mb-4 border-b pb-2">
          <button
            className="flex justify-between items-center w-full text-xl font-bold text-left"
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            <h2>Product Details</h2>
            <span>{detailsOpen ? '-' : '+'}</span>
          </button>
          {detailsOpen && (
            <ul className="list-disc list-inside text-gray-700 mt-2">
              <li><span className="font-bold">Size: </span>{product.size}ml</li>
              <li>
                <span className="font-bold">Availability: </span>
                {product.availability > 24 ? (
                  <span className="text-green-600">In Stock</span>
                ) : (
                  <span className="text-orange-600">Only {product.availability} bottles left!</span>
                )}
              </li>
              <li><span className="font-bold">Alcohol: </span>{product.alcohol}% ABV</li>
            </ul>
          )}
        </div>

        {/* Characteristics Section */}
        <div className="mb-4 border-b pb-2">
          <button
            className="flex justify-between items-center w-full text-xl font-bold text-left"
            onClick={() => setCharacteristicsOpen(!characteristicsOpen)}
          >
            <h2>Characteristics</h2>
            <span>{characteristicsOpen ? '-' : '+'}</span>
          </button>
          {characteristicsOpen && (
            <ul className="list-disc list-inside text-gray-700 mt-2">
              <li><span className="font-bold">Organoleptic: </span>{product.organoleptic}</li>
              <li><span className="font-bold">Taste: </span>{product.taste}</li>
              <li><span className="font-bold">Smell: </span>{product.smell}</li>
              <li><span className="font-bold">Body: </span>{product.body}</li>
            </ul>
          )}
        </div>

        {/* Ingredients Section */}
        <div className="mb-4">
          <button
            className="flex justify-between items-center w-full text-xl font-bold text-left"
            onClick={() => setIngredientsOpen(!ingredientsOpen)}
          >
            <h2>Ingredients</h2>
            <span>{ingredientsOpen ? '-' : '+'}</span>
          </button>
          {ingredientsOpen && (
            <p className="text-gray-700 mt-2"><span className="font-bold">Ingredients: </span>{product.ingredients}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;