import { isLanguage, DEFAULT_LANGUAGE, Language } from '../hooks/useLanguage';
import { setCookie, ONE_YEAR_SECONDS } from './cookies';
import { getConsent } from './consent';

/// Persists the active language as a cookie so the nginx root-redirect
/// (`location = /`) can route first-paint requests to /:lang without booting
/// the SPA. Lives alongside the localStorage write that drives i18next.
/// Both writes are consent-gated: without accepted cookie consent the
/// language still works for the session (URL prefix + navigator.language)
/// but is not persisted.
export function writeLangCookie(lang: Language): void {
    if (getConsent() !== 'accepted') return;
    setCookie('lang', lang, ONE_YEAR_SECONDS);
}

/// Single entry point for persisting a language choice (cookie + the
/// localStorage mirror that seeds i18next on the next visit).
export function persistLang(lang: Language): void {
    writeLangCookie(lang);
    if (getConsent() !== 'accepted') return;
    try {
        window.localStorage?.setItem('i18nextLng', lang);
    } catch {
        // localStorage may be unavailable (private mode, etc.)
    }
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
