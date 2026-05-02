import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFetchProducts } from '../hooks/useFetchProducts';
import { useFetchEnums } from '../hooks/useFetchEnums';
import { getEnumLabel } from '../enums';
import ProductCard from '../components/ProductCard';
import ErrorDisplay from '../components/ErrorDisplay';
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
    const [tannins, setTannins] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const filtersInitialized = useRef(false);
    const filtersTriggerRef = useRef<HTMLButtonElement>(null);
    const filtersAsideRef = useRef<HTMLElement>(null);
    const { t } = useTranslation();

    const activeFilterCount =
        (orderBy !== '' ? 1 : 0) +
        (inStock ? 1 : 0) +
        (productType !== '' ? 1 : 0) +
        (sweetness !== '' ? 1 : 0) +
        (turbidity !== '' ? 1 : 0) +
        (effervescence !== '' ? 1 : 0) +
        (acidity !== '' ? 1 : 0) +
        (tannins !== '' ? 1 : 0) +
        (body !== '' ? 1 : 0) +
        (search !== '' ? 1 : 0);

    const { enums } = useFetchEnums();
    const { products, isLoading, error, hasMore, totalPages, refetch } = useFetchProducts(
        orderBy,
        inStock,
        orderDirection,
        productType,
        sweetness,
        turbidity,
        effervescence,
        acidity,
        tannins,
        body,
        search,
        page
    );

    useEffect(() => {
        if (!filtersInitialized.current) {
            filtersInitialized.current = true;
            return;
        }
        setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderBy, inStock, orderDirection, productType, sweetness, turbidity, effervescence, acidity, tannins, body, search]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        if (!isMobile) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusable = filtersAsideRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsFiltersOpen(false);
                filtersTriggerRef.current?.focus();
            }
        };

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (
                filtersAsideRef.current &&
                !filtersAsideRef.current.contains(target) &&
                filtersTriggerRef.current &&
                !filtersTriggerRef.current.contains(target)
            ) {
                setIsFiltersOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [isFiltersOpen]);

    if (error) {
        return (
            <div className="shop-page">
                <header className="shop-header">
                    <h1>{t('shop.title')}</h1>
                    <p>{t('shop.subtitle')}</p>
                </header>
                <ErrorDisplay error={error} onRetry={refetch} retryLabel={t('common.retry')} />
            </div>
        );
    }

    return (
        <div className="shop-page">
            <header className="shop-header">
                <h1>{t('shop.title')}</h1>
                <p>{t('shop.subtitle')}</p>
            </header>
            
            <button
                ref={filtersTriggerRef}
                type="button"
                className="filters-trigger"
                onClick={() => setIsFiltersOpen(true)}
                aria-expanded={isFiltersOpen}
                aria-controls="filters-sidebar"
            >
                <span>{t('shop.showFilters')}</span>
                {activeFilterCount > 0 && (
                    <span
                        className="filters-trigger-badge"
                        aria-label={t('shop.activeFiltersCount', { count: activeFilterCount })}
                    >
                        {activeFilterCount}
                    </span>
                )}
            </button>

            <div className="shop-content">
                <aside
                    id="filters-sidebar"
                    ref={filtersAsideRef}
                    className={`filters-sidebar ${isFiltersOpen ? 'is-open' : ''}`}
                >
                    <div className="filters-sidebar-mobile-header">
                        <h3>{t('shop.filters')}</h3>
                        <button
                            type="button"
                            className="filters-close-btn"
                            onClick={() => setIsFiltersOpen(false)}
                            aria-label={t('shop.closeFilters')}
                        >
                            ×
                        </button>
                    </div>
                    <h3 className="filters-desktop-heading">{t('shop.filters')}</h3>

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
                                setTannins('');
                                setBody('');
                                setSearch('');
                                setPage(1);
                                setIsFiltersOpen(false);
                            }}
                        >
                            {t('shop.clearFilters')}
                        </button>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="search-input">{t('shop.searchByName')}</label>
                        <input
                            id="search-input"
                            type="text"
                            className="search-input"
                            placeholder={t('shop.searchPlaceholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {enums && (
                        <fieldset className="filter-fieldset">
                            <legend>{t('shop.characteristics')}</legend>
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
                                            label: getEnumLabel(enumValue.value, 'mead_type', t)
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
                                            label: getEnumLabel(enumValue.value, 'sweetness', t)
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
                                            label: getEnumLabel(enumValue.value, 'turbidity', t)
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
                                            label: getEnumLabel(enumValue.value, 'effervescence', t)
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
                                            label: getEnumLabel(enumValue.value, 'acidity', t)
                                        }))
                                    ]}
                                />
                            </div>

                            <div className="filter-group">
                                <SelectInput
                                    id="tannins"
                                    label={t('shop.tannins')}
                                    name="tannins"
                                    value={tannins}
                                    onChange={(e) => setTannins(e.target.value)}
                                    options={[
                                        { value: '', label: t('shop.allTanins') },
                                        ...enums.tannins.map(enumValue => ({
                                            value: enumValue.value,
                                            label: getEnumLabel(enumValue.value, 'tannins', t)
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
                                            label: getEnumLabel(enumValue.value, 'body', t)
                                        }))
                                    ]}
                                />
                            </div>
                        </fieldset>
                    )}
                </aside>

                <div
                    className={`filters-backdrop ${isFiltersOpen ? 'is-open' : ''}`}
                    onClick={() => setIsFiltersOpen(false)}
                    aria-hidden="true"
                />

                <main className="product-display">
                    {isLoading ? (
                        <div className="product-grid">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <ProductCard key={i} renderSkeleton />
                            ))}
                        </div>
                    ) : products.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon search-empty-icon"></div>
                            <h3>{t('shop.noProducts')}</h3>
                            <p>{t('shop.noProductsDescription')}</p>
                        </div>
                    ) : (
                        <div className="product-grid">
                            {products.map(productWithImage => (
                                <ProductCard
                                    key={productWithImage.product.product_id}
                                    productWithImage={productWithImage}
                                />
                            ))}
                        </div>
                    )}
                    {!isLoading && (
                        <Pagination
                            page={page}
                            hasMore={hasMore}
                            totalPages={totalPages}
                            onPrevPage={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            onNextPage={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

export default Shop;