import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { ProductWithImage } from '../types';

interface UseFetchProductsResult {
  products: ProductWithImage[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void; // Function to manually refetch products
}



export const useFetchProducts = (
  orderBy: string,
  inStock: boolean,
  orderDirection: string,
  productType: string,
  sweetness: string,
  turbidity: string,
  effervescence: string,
  acidity: string,
  tanins: string,
  body: string
): UseFetchProductsResult => {
  const [products, setProducts] = useState<ProductWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0); // To manually trigger refetch

  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
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
        if (orderBy && orderDirection) { // Only append order_direction if orderBy is also present
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
        if (tanins) {
          params.append('tanins', tanins);
        }
        if (body) {
          params.append('body', body);
        }
        if (params.toString()) {
          url = `${url}?${params.toString()}`;
        }
        
        const data = await api.get(url);
        setProducts(data);
      } catch (err) {
        setError('Failed to fetch products. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [fetchTrigger, orderBy, inStock, orderDirection, productType, sweetness, turbidity, effervescence, acidity, tanins, body]); // Dependency on fetchTrigger for manual refetch

  return { products, isLoading, error, refetch };
};