import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { LocalizedProductWithImage } from '../types';
import type { AcidityType } from '../types/generated/AcidityType';
import type { BodyType } from '../types/generated/BodyType';
import type { EffervescenceType } from '../types/generated/EffervescenceType';
import type { MeadType } from '../types/generated/MeadType';
import type { SweetnessType } from '../types/generated/SweetnessType';
import type { TanninsType } from '../types/generated/TanninsType';
import type { TurbidityType } from '../types/generated/TurbidityType';
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
            product_type: (productType || undefined) as MeadType | undefined,
            sweetness: (sweetness || undefined) as SweetnessType | undefined,
            turbidity: (turbidity || undefined) as TurbidityType | undefined,
            effervescence: (effervescence || undefined) as EffervescenceType | undefined,
            acidity: (acidity || undefined) as AcidityType | undefined,
            tannins: (tannins || undefined) as TanninsType | undefined,
            body: (body || undefined) as BodyType | undefined,
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
