import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Image } from '../types';

interface AdminImagesContextType {
    images: Image[];
    setImages: React.Dispatch<React.SetStateAction<Image[]>>;
    loading: boolean;
    error: string;
    setError: React.Dispatch<React.SetStateAction<string>>;
    refetch: () => Promise<void>;
    ensureFetched: () => void;
}

const AdminImagesContext = createContext<AdminImagesContextType | null>(null);

// Holds the admin image list once per layout mount so AdminImages,
// AdminProductCreate, and AdminProductEdit share a single GET /admin/images
// instead of each firing their own. The fetch is deferred until the first
// consumer mounts, so admin pages that don't use images never trigger it.
export function AdminImagesProvider({ children }: { children: ReactNode }) {
    const [images, setImages] = useState<Image[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const startedRef = useRef(false);
    const { t } = useTranslation();

    const refetch = useCallback(async () => {
        startedRef.current = true;
        setLoading(true);
        setError('');
        try {
            setImages(await api.getImages());
        } catch {
            setError(t('admin.images.error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const ensureFetched = useCallback(() => {
        if (!startedRef.current) refetch();
    }, [refetch]);

    return (
        <AdminImagesContext.Provider value={{ images, setImages, loading, error, setError, refetch, ensureFetched }}>
            {children}
        </AdminImagesContext.Provider>
    );
}

export function useAdminImages(): Omit<AdminImagesContextType, 'ensureFetched'> {
    const context = useContext(AdminImagesContext);
    if (!context) throw new Error('useAdminImages must be used within an AdminImagesProvider');
    const { ensureFetched, ...images } = context;
    useEffect(() => { ensureFetched(); }, [ensureFetched]);
    return images;
}
