import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { EnumValues } from '../enums';

export function useFetchEnums() {
    const [enums, setEnums] = useState<EnumValues | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEnums = async () => {
            try {
                setLoading(true);
                const response = await api.get('/enums') as EnumValues;
                setEnums(response);
                setError(null);
            } catch (err) {
                setError('Failed to fetch enum values');
                console.error('Error fetching enums:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchEnums();
    }, []);

    return { enums, loading, error };
}