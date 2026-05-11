import { isLanguage, DEFAULT_LANGUAGE, Language } from '../hooks/useLanguage';

const ONE_YEAR_SECONDS = 31_536_000;

/// Persists the active language as a cookie so the nginx root-redirect
/// (`location = /`) can route first-paint requests to /:lang without booting
/// the SPA. Lives alongside the localStorage write that drives i18next.
export function writeLangCookie(lang: Language): void {
    if (typeof document === 'undefined') return;
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const secure = isHttps ? '; Secure' : '';
    document.cookie = `lang=${lang}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

export function detectInitialLang(): Language {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
    let resolved: Language = DEFAULT_LANGUAGE;
    try {
        const stored = window.localStorage?.getItem('i18nextLng');
        if (stored && isLanguage(stored)) {
            resolved = stored;
        } else {
            const nav = window.navigator?.language?.toLowerCase() ?? '';
            if (nav.startsWith('ro')) resolved = 'ro';
            else if (nav.startsWith('en')) resolved = 'en';
        }
    } catch {
        // localStorage may be unavailable (private mode, etc.) — fall through
    }
    writeLangCookie(resolved);
    return resolved;
}
