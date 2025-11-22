// src/app/products/[slug]/page.tsx
import ProductDetails from '@/components/ProductDetails';

const ProductPage = ({ params }: { params: { slug: string } }) => {
  // In a real application, you would fetch product data based on the slug
  const product = {
    name: 'Golden Nectar',
    image: 'https://placehold.co/600x600/FACC15/000000/png?text=Golden+Nectar',
    details: {
      size: '750ml',
      price: '€25.00',
      availability: 'In Stock',
    },
    description: 'A sweet and floral mead with hints of honey and citrus. This mead represents the warmth of a summer evening.',
    characteristics: {
      organoleptic: 'Clear, bright gold',
      taste: 'Sweet, honey, citrus',
      smell: 'Floral, honey',
      body: 'Medium-bodied',
      alcohol: '12%',
    },
    ingredients: ['Water', 'Honey', 'Yeast', 'Orange Peel', 'Spices'],
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <ProductDetails product={product} />
    </div>
  );
};

export default ProductPage;
