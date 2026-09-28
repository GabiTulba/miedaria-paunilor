import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/// Reads the given query parameters once and removes them from the address
/// bar, so emailed tokens don't linger in history or leak via Referer.
export function useConsumedParams<K extends string>(keys: readonly K[]): Record<K, string | null> {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [values] = useState(() => {
        const read = Object.fromEntries(keys.map(key => [key, searchParams.get(key)])) as Record<K, string | null>;
        if (keys.some(key => searchParams.has(key))) navigate(pathname, { replace: true });
        return read;
    });
    return values;
}
