import { useEffect, useState, useCallback, useRef, DependencyList } from 'react';

export interface UseFetchResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

// Generic fetch-on-mount + on-deps-change hook. Encapsulates the AbortController +
// AbortError early-return + signal-aborted-in-finally pattern duplicated across ~10
// components. The fetcher receives the AbortSignal so it can pass it to the API call.
//
// Re-fetch on demand via the returned `refetch()`. The hook intentionally does NOT
// expose `setData`; if a caller needs optimistic updates, hold the data in local state
// keyed off `data`.
export function useFetch<T>(
    fetcher: (signal: AbortSignal) => Promise<T>,
    deps: DependencyList,
): UseFetchResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [tick, setTick] = useState(0);

    // Stash the latest fetcher so we don't re-run when only its identity changes.
    // The user controls re-runs through `deps`.
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetcherRef.current(controller.signal)
            .then(result => {
                if (cancelled || controller.signal.aborted) return;
                setData(result);
            })
            .catch(err => {
                if (cancelled || controller.signal.aborted) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError(err instanceof Error ? err : new Error(String(err)));
            })
            .finally(() => {
                if (!cancelled && !controller.signal.aborted) setLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, tick]);

    return { data, loading, error, refetch };
}
