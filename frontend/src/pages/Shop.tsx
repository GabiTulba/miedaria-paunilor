import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchProducts } from '../hooks/useFetchProducts';
import ProductCard from '../components/ProductCard';
import SelectInput from '../components/forms/SelectInput';
import './Shop.css';

function Shop() {
    const [orderBy, setOrderBy] = useState<string>('');
    const [orderDirection, setOrderDirection] = useState<string>('asc');
    const [inStock, setInStock] = useState<boolean>(false);
    const { t } = useTranslation();

    const { products, isLoading, error, refetch } = useFetchProducts(orderBy, inStock, orderDirection);

    useEffect(() => {
        refetch();
    }, [orderBy, inStock, orderDirection, refetch]);

    if (isLoading) {
        return <div className="loader">{t('common.loading')}</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="shop-page">
            <header className="shop-header">
                <h1>{t('shop.title')}</h1>
                <p>{t('shop.subtitle')}</p>
            </header>
            
            <div className="shop-content">
                <aside className="filters-sidebar">
                    <h3>{t('shop.filters')}</h3>

                    <div className="filter-group">
                        <SelectInput
                            id="orderBy"
                            label={t('shop.orderBy')}
                            name="orderBy"
                            value={orderBy}
                            onChange={(e) => setOrderBy(e.target.value)}
                            options={[
                                { value: '', label: t('shop.none') },
                                { value: 'price', label: t('shop.price') },
                                { value: 'volume', label: t('shop.volume') },
                            ]}
                        />
                    </div>

                    {orderBy && (
                        <div className="filter-group">
                            <SelectInput
                                id="orderDirection"
                                label={t('shop.orderDirection')}
                                name="orderDirection"
                                value={orderDirection}
                                onChange={(e) => setOrderDirection(e.target.value)}
                                options={[
                                    { value: 'asc', label: t('shop.ascending') },
                                    { value: 'desc', label: t('shop.descending') },
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
                        <label htmlFor="inStock">{t('shop.inStockOnly')}</label>
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