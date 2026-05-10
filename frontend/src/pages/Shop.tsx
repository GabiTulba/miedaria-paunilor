import { useEffect, useRef, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchProducts } from '../hooks/useFetchProducts';
import { usePageParam } from '../hooks/usePageParam';
import { useShopFilters } from '../hooks/useShopFilters';
import { EnumContext } from '../context/EnumContext';
import ProductCard from '../components/ProductCard';
import ErrorDisplay from '../components/ErrorDisplay';
import Pagination from '../components/Pagination';
import SelectInput from '../components/forms/SelectInput';
import EnumSelect from '../components/forms/EnumSelect';
import SEO from '../components/SEO';
import { useFocusTrapDrawer } from '../hooks/useFocusTrapDrawer';
import './Shop.css';

function Shop() {
    const { filters, setFilter, clearFilters, activeCount } = useShopFilters();
    const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
    const [page, setPage] = usePageParam();
    const filtersInitialized = useRef(false);
    const filtersTriggerRef = useRef<HTMLButtonElement>(null);
    const filtersAsideRef = useRef<HTMLElement>(null);
    const { t } = useTranslation();

    const { enums } = useContext(EnumContext);
    const { products, isLoading, error, hasMore, totalPages, refetch } = useFetchProducts(
        filters.orderBy,
        filters.inStock,
        filters.orderDirection,
        filters.productType,
        filters.sweetness,
        filters.turbidity,
        filters.effervescence,
        filters.acidity,
        filters.tannins,
        filters.body,
        filters.search,
        page
    );

    useEffect(() => {
        if (!filtersInitialized.current) {
            filtersInitialized.current = true;
            return;
        }
        setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    useFocusTrapDrawer({
        open: isFiltersOpen,
        onClose: () => setIsFiltersOpen(false),
        drawerRef: filtersAsideRef,
        triggerRef: filtersTriggerRef,
    });

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
            <SEO title={t('seo.pageTitles.shop')} description={t('seo.pageDescriptions.shop')} />
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
                {activeCount > 0 && (
                    <span
                        className="filters-trigger-badge"
                        aria-label={t('shop.activeFiltersCount', { count: activeCount })}
                    >
                        {activeCount}
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
                            value={filters.orderBy}
                            onChange={(e) => setFilter('orderBy', e.target.value)}
                            options={[
                                { value: '', label: t('shop.none') },
                                { value: 'price', label: t('shop.price') },
                                { value: 'volume', label: t('shop.volume') },
                                { value: 'bottling_date', label: t('shop.bottlingDate') },
                            ]}
                        />
                    </div>

                    {filters.orderBy && (
                        <div className="filter-group">
                            <SelectInput
                                id="orderDirection"
                                label={t('shop.orderDirection')}
                                name="orderDirection"
                                value={filters.orderDirection}
                                onChange={(e) => setFilter('orderDirection', e.target.value)}
                                options={[
                                    { value: 'asc', label: t('shop.ascending') },
                                    { value: 'desc', label: t('shop.descending') },
                                ]}
                            />
                        </div>
                    )}

                     <div className="filter-group checkbox-group">
                        <label htmlFor="inStock" className="checkbox-label">
                            <input
                                type="checkbox"
                                id="inStock"
                                checked={filters.inStock}
                                onChange={(e) => setFilter('inStock', e.target.checked)}
                            />
                            <span>{t('shop.inStockOnly')}</span>
                        </label>
                    </div>

                    <div className="filter-group">
                        <button
                            className="clear-filters-btn"
                            onClick={() => {
                                clearFilters();
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
                            value={filters.search}
                            onChange={e => setFilter('search', e.target.value)}
                        />
                    </div>

                    {enums && (
                        <fieldset className="filter-fieldset">
                            <legend>{t('shop.characteristics')}</legend>
                            <div className="filter-group">
                                <EnumSelect id="productType" label={t('shop.productType')} kind="mead_type" value={filters.productType} onChange={(e) => setFilter('productType', e.target.value)} placeholder={t('shop.allTypes')} />
                            </div>
                            <div className="filter-group">
                                <EnumSelect id="sweetness" label={t('shop.sweetness')} kind="sweetness" value={filters.sweetness} onChange={(e) => setFilter('sweetness', e.target.value)} placeholder={t('shop.allSweetness')} />
                            </div>
                            <div className="filter-group">
                                <EnumSelect id="turbidity" label={t('shop.turbidity')} kind="turbidity" value={filters.turbidity} onChange={(e) => setFilter('turbidity', e.target.value)} placeholder={t('shop.allTurbidity')} />
                            </div>
                            <div className="filter-group">
                                <EnumSelect id="effervescence" label={t('shop.effervescence')} kind="effervescence" value={filters.effervescence} onChange={(e) => setFilter('effervescence', e.target.value)} placeholder={t('shop.allEffervescence')} />
                            </div>
                            <div className="filter-group">
                                <EnumSelect id="acidity" label={t('shop.acidity')} kind="acidity" value={filters.acidity} onChange={(e) => setFilter('acidity', e.target.value)} placeholder={t('shop.allAcidity')} />
                            </div>
                            <div className="filter-group">
                                <EnumSelect id="tannins" label={t('shop.tannins')} kind="tannins" value={filters.tannins} onChange={(e) => setFilter('tannins', e.target.value)} placeholder={t('shop.allTannins')} />
                            </div>
                            <div className="filter-group">
                                <EnumSelect id="body" label={t('shop.body')} kind="body" value={filters.body} onChange={(e) => setFilter('body', e.target.value)} placeholder={t('shop.allBody')} />
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
                            onPrevPage={() => setPage(page - 1)}
                            onNextPage={() => setPage(page + 1)}
                            scrollOnChange
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

export default Shop;
