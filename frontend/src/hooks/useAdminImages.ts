import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Image } from '../types';

interface UseAdminImagesResult {
    images: Image[];
    setImages: React.Dispatch<React.SetStateAction<Image[]>>;
    loading: boolean;
    error: string;
    setError: React.Dispatch<React.SetStateAction<string>>;
    refetch: () => Promise<void>;
}

export function useAdminImages(token: string | null): UseAdminImagesResult {
    const [images, setImages] = useState<Image[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { t } = useTranslation();

    const refetch = useCallback(async () => {
        if (!token) {
            setError(t('errors.unauthorized'));
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const fetched = await api.getImages(token);
            setImages(fetched);
        } catch {
            setError(t('admin.images.error'));
        } finally {
            setLoading(false);
        }
    }, [token, t]);

    useEffect(() => { refetch(); }, [refetch]);

    return { images, setImages, loading, error, setError, refetch };
}
