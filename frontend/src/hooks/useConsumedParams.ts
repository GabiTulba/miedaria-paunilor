import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/// Reads the given query parameters once and removes them from the address
/// bar, so emailed tokens don't linger in history or leak via Referer.
export function useConsumedParams<K extends string>(keys: readonly K[]): Record<K, string | null> {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [values] = useState(
        () => Object.fromEntries(keys.map(key => [key, searchParams.get(key)])) as Record<K, string | null>,
    );
    const present = keys.some(key => searchParams.has(key));

    // React Router ignores navigation during render, so this has to be an effect.
    useEffect(() => {
        if (present) navigate(pathname, { replace: true });
    }, [present, pathname, navigate]);

    return values;
}
