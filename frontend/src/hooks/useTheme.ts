import { useState, useEffect, useCallback } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

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

export function useTheme() {
    const [preference, setPreference] = useState<ThemePreference>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
        return 'system';
    });

    const resolvedTheme = preference === 'system' ? getSystemTheme() : preference;

    useEffect(() => {
        applyTheme(preference);
        localStorage.setItem(STORAGE_KEY, preference);
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
