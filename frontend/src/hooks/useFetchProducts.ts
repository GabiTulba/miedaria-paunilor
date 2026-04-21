import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { LocalizedProductWithImage } from '../types';
import { useLanguage } from './useLanguage';

interface UseFetchProductsResult {
  products: LocalizedProductWithImage[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  refetch: () => void;
}

const PER_PAGE = 20;



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
  page: number
): UseFetchProductsResult => {
  const language = useLanguage();
  const [products, setProducts] = useState<LocalizedProductWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url = '/products';
        const params = new URLSearchParams();
        if (orderBy) {
          params.append('order_by', orderBy);
        }
        if (inStock) {
          params.append('in_stock', 'true');
        }
        if (orderBy && orderDirection) {
          params.append('order_direction', orderDirection);
        }
        if (productType) {
          params.append('product_type', productType);
        }
        if (sweetness) {
          params.append('sweetness', sweetness);
        }
        if (turbidity) {
          params.append('turbidity', turbidity);
        }
        if (effervescence) {
          params.append('effervescence', effervescence);
        }
        if (acidity) {
          params.append('acidity', acidity);
        }
        if (tannins) {
          params.append('tannins', tannins);
        }
        if (body) {
          params.append('body', body);
        }
        params.append('page', String(page));
        params.append('per_page', String(PER_PAGE));
        params.append('limit', String(PER_PAGE + 1));
        url = `${url}?${params.toString()}`;

        const data = await api.get(url, { signal: controller.signal });
        setHasMore(data.length > PER_PAGE);
        setProducts(data.slice(0, PER_PAGE));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Failed to fetch products. Please try again later.');
        console.error(err);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => { controller.abort(); };
  }, [fetchTrigger, orderBy, inStock, orderDirection, productType, sweetness, turbidity, effervescence, acidity, tannins, body, page, language]);

  return { products, isLoading, error, hasMore, refetch };
};