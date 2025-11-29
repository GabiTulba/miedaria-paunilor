import { useEffect, useState } from 'react';
import { Product } from '../types';
import { Link } from 'react-router-dom';

function Shop() {
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/products`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setProducts(data);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            }
        };

        fetchProducts();
    }, []);

    return (
        <div>
            <h2>Shop</h2>
            <ul>
                {products.map(product => (
                    <li key={product.product_id}>
                        <Link to={`/shop/${product.product_id}`}>
                            <h3>{product.product_name}</h3>
                        </Link>
                        <p>{product.price} €</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Shop;