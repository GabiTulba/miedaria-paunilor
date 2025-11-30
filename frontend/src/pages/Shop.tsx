import { useEffect, useState } from 'react';
import { ProductWithImage } from '../types'; // Import ProductWithImage
import { api } from '../lib/api';
import { Link } from 'react-router-dom';
import './Shop.css';

function Shop() {
    const [products, setProducts] = useState<ProductWithImage[]>([]); // Change type here
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            try {
                const data = await api.getProducts();
                setProducts(data);
            } catch (err) {
                setError('Failed to fetch products. Please try again later.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (isLoading) {
        return <div className="loader">Loading...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="shop-page">
            <header className="shop-header">
                <h1>Our Collection</h1>
                <p>Discover our unique selection of handcrafted meads.</p>
            </header>
            
            <div className="shop-content">
                <aside className="filters-sidebar">
                    <h3>Filters</h3>
                    {/* Add filter controls here */}
                    <div className="filter-group">
                        <h4>Sort by Price</h4>
                        <select>
                            <option value="asc">Low to High</option>
                            <option value="desc">High to Low</option>
                        </select>
                    </div>
                </aside>

                <main className="product-display">
                    <div className="product-grid">
                        {products.map(productWithImage => ( // Iterate over ProductWithImage
                            <div key={productWithImage.product.product_id} className="product-card">
                                <Link to={`/shop/${productWithImage.product.product_id}`}>
                                    <div className="product-card-main">
                                        <div className="product-card-image">
                                            {productWithImage.image ? (
                                                <img 
                                                    src={`/images/${productWithImage.image.id}`} 
                                                    alt={productWithImage.product.product_name} 
                                                    className="product-image" 
                                                />
                                            ) : (
                                                <div className="placeholder-image">No Image</div>
                                            )}
                                        </div>
                                        <div className="product-card-content">
                                            <h3>{productWithImage.product.product_name}</h3>
                                            <p className="price">{productWithImage.product.price} €</p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Shop;