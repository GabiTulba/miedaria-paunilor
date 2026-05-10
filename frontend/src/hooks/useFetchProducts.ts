import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { LocalizedProductWithImage } from '../types';
import { useFetch } from './useFetch';

interface UseFetchProductsResult {
    products: LocalizedProductWithImage[];
    isLoading: boolean;
    error: string | null;
    hasMore: boolean;
    totalPages: number;
    refetch: () => void;
}

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 250;

// `search` is debounced 250ms before triggering a fetch so typing in the search box
// doesn't fire one request per keystroke. All other filters fire immediately.
export const useFetchProducts = (
    orderBy: string,
    inStock: boolean,
    orderDirection: string,
    productType: string,
    sweetness: string,
    turbidity: string,
    effervescence: string,
    acidity: string,
    tannins: string,
    body: string,
    search: string,
    page: number,
): UseFetchProductsResult => {
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    const { i18n } = useTranslation();

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [search]);

    const { data, loading, error, refetch } = useFetch(
        signal => api.getProducts({
            order_by: orderBy || undefined,
            order_direction: orderBy ? orderDirection : undefined,
            in_stock: inStock,
            product_type: productType || undefined,
            sweetness: sweetness || undefined,
            turbidity: turbidity || undefined,
            effervescence: effervescence || undefined,
            acidity: acidity || undefined,
            tannins: tannins || undefined,
            body: body || undefined,
            search: debouncedSearch || undefined,
            page,
            per_page: PER_PAGE,
        }, signal),
        [orderBy, inStock, orderDirection, productType, sweetness, turbidity, effervescence, acidity, tannins, body, debouncedSearch, page, i18n.language],
    );

    const totalPages = data?.total_pages ?? 1;
    return {
        products: data?.items ?? [],
        isLoading: loading,
        error: error ? error.message : null,
        hasMore: page < totalPages,
        totalPages,
        refetch,
    };
};
