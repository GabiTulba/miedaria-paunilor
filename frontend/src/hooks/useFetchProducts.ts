import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { LocalizedProductWithImage } from '../types';
import i18n from '../i18n/config';

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
  page: number
): UseFetchProductsResult => {
  const [products, setProducts] = useState<LocalizedProductWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (search === debouncedSearch) return;
    const id = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getProducts({
          order_by: orderBy || undefined,
          order_direction: orderBy ? orderDirection : undefined,
          in_stock: inStock || undefined,
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
        }, controller.signal);
        if (controller.signal.aborted) return;
        setTotalPages(data.total_pages ?? 1);
        setHasMore(page < (data.total_pages ?? 1));
        setProducts(data.items ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(i18n.t('errors.fetchProducts'));
        console.error(err);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => { controller.abort(); };
  }, [fetchTrigger, orderBy, inStock, orderDirection, productType, sweetness, turbidity, effervescence, acidity, tannins, body, debouncedSearch, page]);

  return { products, isLoading, error, hasMore, totalPages, refetch };
};