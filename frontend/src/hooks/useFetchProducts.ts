import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ProductWithImage } from '../types';

interface UseFetchProductsResult {
  products: ProductWithImage[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void; // Function to manually refetch products
}

export const useFetchProducts = (): UseFetchProductsResult => {
  const [products, setProducts] = useState<ProductWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0); // To manually trigger refetch

  const refetch = () => {
    setFetchTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        setError('Failed to fetch products. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [fetchTrigger]); // Dependency on fetchTrigger for manual refetch

  return { products, isLoading, error, refetch };
};