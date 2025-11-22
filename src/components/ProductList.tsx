import Image from 'next/image';

const products = [
  {
    name: 'Golden Nectar',
    description: 'A sweet and floral mead with hints of honey and citrus.',
    image: 'https://placehold.co/300x400/FACC15/000000/png?text=Golden+Nectar',
  },
  {
    name: 'Wildflower Brew',
    description: 'A complex and aromatic mead with a blend of wildflower honey.',
    image: 'https://placehold.co/300x400/8B5CF6/FFFFFF/png?text=Wildflower+Brew',
  },
  {
    name: 'Spiced Mead',
    description: 'A warm and spicy mead with notes of cinnamon, cloves, and nutmeg.',
    image: 'https://placehold.co/300x400/F97316/FFFFFF/png?text=Spiced+Mead',
  },
    {
    name: 'Forest Blend',
    description: 'A rich and earthy mead with a deep, complex flavor profile.',
    image: 'https://placehold.co/300x400/16A34A/FFFFFF/png?text=Forest+Blend',
  },
];

const ProductList = () => {
  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">Our Meads</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <div key={product.name} className="bg-white rounded-lg shadow-md overflow-hidden">
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductList;
