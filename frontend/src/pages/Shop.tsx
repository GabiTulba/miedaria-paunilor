import { Link } from 'react-router-dom';
import { useFetchProducts } from '../hooks/useFetchProducts';
import ProductCard from '../components/ProductCard'; // Import the new ProductCard component
import './Shop.css';

function Shop() {
    const { products, isLoading, error } = useFetchProducts();

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
                        {products.map(productWithImage => (
                            <ProductCard 
                                key={productWithImage.product.product_id} 
                                productWithImage={productWithImage} 
                            />
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Shop;