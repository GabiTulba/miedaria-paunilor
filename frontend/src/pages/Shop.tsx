import { useState, useEffect } from 'react';
import { useFetchProducts } from '../hooks/useFetchProducts';
import ProductCard from '../components/ProductCard'; // Import the new ProductCard component
import SelectInput from '../components/forms/SelectInput';
import './Shop.css';

function Shop() {
    const [orderBy, setOrderBy] = useState<string>('');
    const [orderDirection, setOrderDirection] = useState<string>('asc'); // 'asc' for ascending, 'desc' for descending
    const [inStock, setInStock] = useState<boolean>(false);

    const { products, isLoading, error, refetch } = useFetchProducts(orderBy, inStock, orderDirection);

    useEffect(() => {
        refetch();
    }, [orderBy, inStock, orderDirection, refetch]);

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
                        <SelectInput
                            id="orderBy"
                            label="Order By"
                            name="orderBy"
                            value={orderBy}
                            onChange={(e) => setOrderBy(e.target.value)}
                            options={[
                                { value: '', label: 'None' },
                                { value: 'price', label: 'Price' },
                                { value: 'volume', label: 'Volume' },
                            ]}
                        />
                    </div>

                    {orderBy && ( // Only show order direction if an order by option is selected
                        <div className="filter-group">
                            <SelectInput
                                id="orderDirection"
                                label="Order Direction"
                                name="orderDirection"
                                value={orderDirection}
                                onChange={(e) => setOrderDirection(e.target.value)}
                                options={[
                                    { value: 'asc', label: 'Ascending' },
                                    { value: 'desc', label: 'Descending' },
                                ]}
                            />
                        </div>
                    )}

                    <div className="filter-group checkbox-group">
                        <input
                            type="checkbox"
                            id="inStock"
                            checked={inStock}
                            onChange={(e) => setInStock(e.target.checked)}
                        />
                        <label htmlFor="inStock">In Stock Only</label>
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