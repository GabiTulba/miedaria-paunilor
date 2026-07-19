import { useCallback, useEffect, useRef, useState } from 'react';

// Must match the `success-pulse` animation duration in index.css.
const PULSE_DURATION_MS = 400;

// Keyed "success-pulse" button feedback: `pulse(key)` applies the CSS class for
// the animation's duration, `isPulsing(key)` reads it. Encapsulates the inline
// setTimeout blocks previously duplicated in Cart/ProductDetails.
export function usePulse() {
    const [pulsing, setPulsing] = useState<Record<string, true>>({});
    const timeoutsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        const timeouts = timeoutsRef.current;
        return () => {
            Object.values(timeouts).forEach(id => window.clearTimeout(id));
        };
    }, []);

    const pulse = useCallback((key: string) => {
        window.clearTimeout(timeoutsRef.current[key]);
        timeoutsRef.current[key] = window.setTimeout(() => {
            delete timeoutsRef.current[key];
            setPulsing(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }, PULSE_DURATION_MS);
        setPulsing(prev => ({ ...prev, [key]: true }));
    }, []);

    const isPulsing = useCallback((key: string) => key in pulsing, [pulsing]);

    return { isPulsing, pulse };
}
