import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFetchProducts } from '../hooks/useFetchProducts';
import { useFetchEnums } from '../hooks/useFetchEnums';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import SelectInput from '../components/forms/SelectInput';
import './Shop.css';

function Shop() {
    const [orderBy, setOrderBy] = useState<string>('');
    const [orderDirection, setOrderDirection] = useState<string>('asc');
    const [inStock, setInStock] = useState<boolean>(false);
    const [productType, setProductType] = useState<string>('');
    const [sweetness, setSweetness] = useState<string>('');
    const [turbidity, setTurbidity] = useState<string>('');
    const [effervescence, setEffervescence] = useState<string>('');
    const [acidity, setAcidity] = useState<string>('');
    const [tanins, setTanins] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const filtersInitialized = useRef(false);
    const { t } = useTranslation();

    const { enums, loading: enumsLoading } = useFetchEnums();
    const { products, isLoading, error, hasMore } = useFetchProducts(
        orderBy,
        inStock,
        orderDirection,
        productType,
        sweetness,
        turbidity,
        effervescence,
        acidity,
        tanins,
        body,
        page
    );

    useEffect(() => {
        if (!filtersInitialized.current) {
            filtersInitialized.current = true;
            return;
        }
        setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderBy, inStock, orderDirection, productType, sweetness, turbidity, effervescence, acidity, tanins, body]);

    if (isLoading || enumsLoading) {
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
                                { value: 'bottling_date', label: t('shop.bottlingDate') },
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

                    <div className="filter-group">
                        <button
                            className="clear-filters-btn"
                            onClick={() => {
                                setOrderBy('');
                                setOrderDirection('asc');
                                setInStock(false);
                                setProductType('');
                                setSweetness('');
                                setTurbidity('');
                                setEffervescence('');
                                setAcidity('');
                                setTanins('');
                                setBody('');
                                setPage(1);
                            }}
                        >
                            {t('shop.clearFilters')}
                        </button>
                    </div>

                    {enums && (
                        <>
                            <div className="filter-group">
                                <SelectInput
                                    id="productType"
                                    label={t('shop.productType')}
                                    name="productType"
                                    value={productType}
                                    onChange={(e) => setProductType(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allTypes') },
                                        ...enums.mead_type.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.meadType.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="sweetness"
                                    label={t('shop.sweetness')}
                                    name="sweetness"
                                    value={sweetness}
                                    onChange={(e) => setSweetness(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allSweetness') },
                                        ...enums.sweetness.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.sweetness.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="turbidity"
                                    label={t('shop.turbidity')}
                                    name="turbidity"
                                    value={turbidity}
                                    onChange={(e) => setTurbidity(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allTurbidity') },
                                        ...enums.turbidity.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.turbidity.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="effervescence"
                                    label={t('shop.effervescence')}
                                    name="effervescence"
                                    value={effervescence}
                                    onChange={(e) => setEffervescence(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allEffervescence') },
                                        ...enums.effervescence.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.effervescence.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="acidity"
                                    label={t('shop.acidity')}
                                    name="acidity"
                                    value={acidity}
                                    onChange={(e) => setAcidity(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allAcidity') },
                                        ...enums.acidity.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.acidity.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="tanins"
                                    label={t('shop.tanins')}
                                    name="tanins"
                                    value={tanins}
                                    onChange={(e) => setTanins(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allTanins') },
                                        ...enums.tanins.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.tanins.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="body"
                                    label={t('shop.body')}
                                    name="body"
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allBody') },
                                        ...enums.body.map(enumValue => ({
                                            value: enumValue.value,
                                            label: t(`enums.body.${enumValue.value}`)
                                        }))
                                    ]}
                                />
                            </div>
                        </>
                    )}
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
                    <Pagination
                        page={page}
                        hasMore={hasMore}
                        onPrevPage={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        onNextPage={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    />
                </main>
            </div>
        </div>
    );
}

export default Shop;