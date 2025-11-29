import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { Product } from '../types';
import { CartContext } from '../context/CartContext';

function ProductDetails() {
    const { productId } = useParams<{ productId: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const { addToCart } = useContext(CartContext);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${productId}`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setProduct(data);
            } catch (error) {
                console.error("Failed to fetch product:", error);
            }
        };

        if (productId) {
            fetchProduct();
        }
    }, [productId]);

    if (!product) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h2>{product.product_name}</h2>
            <p>{product.product_description}</p>
            <p>ABV: {product.abv}%</p>
            <p>Volume: {product.bottle_size}ml</p>
            <p>Price: {product.price} €</p>
            <p>In stock: {product.bottle_count}</p>
            <button onClick={() => addToCart(product)}>Add to Cart</button>
        </div>
    );
}

export default ProductDetails;
