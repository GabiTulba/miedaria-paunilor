import { useCallback, useMemo, useReducer } from 'react';

export interface ShopFilters {
    orderBy: string;
    orderDirection: string;
    inStock: boolean;
    productType: string;
    sweetness: string;
    turbidity: string;
    effervescence: string;
    acidity: string;
    tannins: string;
    body: string;
    search: string;
}

export const INITIAL_SHOP_FILTERS: ShopFilters = {
    orderBy: '',
    orderDirection: 'asc',
    inStock: false,
    productType: '',
    sweetness: '',
    turbidity: '',
    effervescence: '',
    acidity: '',
    tannins: '',
    body: '',
    search: '',
};

type Action =
    | { type: 'set'; key: keyof ShopFilters; value: ShopFilters[keyof ShopFilters] }
    | { type: 'reset' };

function reducer(state: ShopFilters, action: Action): ShopFilters {
    switch (action.type) {
        case 'set':
            return { ...state, [action.key]: action.value };
        case 'reset':
            return INITIAL_SHOP_FILTERS;
    }
}

export interface UseShopFiltersResult {
    filters: ShopFilters;
    setFilter: <K extends keyof ShopFilters>(key: K, value: ShopFilters[K]) => void;
    clearFilters: () => void;
    activeCount: number;
}

// Single source of truth for Shop's 11 filter slots. Replaces 11 separate
// useStates and the per-setter enumeration in the clear-all button.
export function useShopFilters(): UseShopFiltersResult {
    const [filters, dispatch] = useReducer(reducer, INITIAL_SHOP_FILTERS);

    const setFilter = useCallback(<K extends keyof ShopFilters>(key: K, value: ShopFilters[K]) => {
        dispatch({ type: 'set', key, value });
    }, []);

    const clearFilters = useCallback(() => dispatch({ type: 'reset' }), []);

    const activeCount = useMemo(() => {
        let count = 0;
        if (filters.orderBy !== '') count++;
        if (filters.inStock) count++;
        if (filters.productType !== '') count++;
        if (filters.sweetness !== '') count++;
        if (filters.turbidity !== '') count++;
        if (filters.effervescence !== '') count++;
        if (filters.acidity !== '') count++;
        if (filters.tannins !== '') count++;
        if (filters.body !== '') count++;
        if (filters.search !== '') count++;
        return count;
    }, [filters]);

    return { filters, setFilter, clearFilters, activeCount };
}
