import { useState, useEffect, useCallback } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

function getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference: ThemePreference) {
    const root = document.documentElement;
    if (preference === 'system') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', preference);
    }
}

function readStoredPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        // localStorage may be unavailable (private mode, etc.)
    }
    return 'system';
}

/// The theme is user-interface customisation the visitor explicitly asks for,
/// so it is stored without cookie consent — but only once an explicit light or
/// dark choice is made; following the system theme leaves nothing behind.
function storePreference(preference: ThemePreference) {
    try {
        if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
        // localStorage may be unavailable (private mode, etc.)
    }
}

export function useTheme() {
    const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);

    const resolvedTheme = preference === 'system' ? getSystemTheme() : preference;

    useEffect(() => {
        applyTheme(preference);
        storePreference(preference);
    }, [preference]);

    useEffect(() => {
        if (preference !== 'system') return;
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [preference]);

    const cycleTheme = useCallback(() => {
        setPreference(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    }, []);

    return { preference, resolvedTheme, cycleTheme, setPreference };
}
