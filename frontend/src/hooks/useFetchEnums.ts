import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { EnumValues } from '../enums';

interface UseFetchEnumsResult {
    enums: EnumValues | null;
    loading: boolean;
    error: string | null;
}

export function useFetchEnums(): UseFetchEnumsResult {
    const [enums, setEnums] = useState<EnumValues | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const fetchEnums = async () => {
            try {
                setLoading(true);
                const response = await api.get('/enums', { signal: controller.signal }) as EnumValues;
                setEnums(response);
                setError(null);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError('Failed to fetch enum values');
                console.error('Error fetching enums:', err);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchEnums();
        return () => { controller.abort(); };
    }, []);

    return { enums, loading, error };
}