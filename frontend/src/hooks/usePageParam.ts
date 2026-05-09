import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// `?page=` synced page state. Clamps to >= 1 and writes back through the router so
// pagination links remain shareable. Replaces the inline
// `Math.max(1, parseInt(searchParams.get('page') || '1', 10))` boilerplate that
// repeated in Shop, Blog, AdminBlog, AdminProducts.
export function usePageParam(): [number, (page: number) => void] {
    const [searchParams, setSearchParams] = useSearchParams();
    const raw = parseInt(searchParams.get('page') || '1', 10);
    const page = Number.isFinite(raw) ? Math.max(1, raw) : 1;

    const setPage = useCallback((next: number) => {
        const params = new URLSearchParams(searchParams);
        if (next <= 1) {
            params.delete('page');
        } else {
            params.set('page', String(next));
        }
        setSearchParams(params);
    }, [searchParams, setSearchParams]);

    return [page, setPage];
}
