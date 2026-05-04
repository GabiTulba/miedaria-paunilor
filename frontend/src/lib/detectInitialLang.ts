import { isLanguage, DEFAULT_LANGUAGE, Language } from '../hooks/useLanguage';

export function detectInitialLang(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage?.getItem('i18nextLng');
    if (stored && isLanguage(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode, etc.) — fall through
  }
  const nav = window.navigator?.language?.toLowerCase() ?? '';
  if (nav.startsWith('ro')) return 'ro';
  if (nav.startsWith('en')) return 'en';
  return DEFAULT_LANGUAGE;
}
