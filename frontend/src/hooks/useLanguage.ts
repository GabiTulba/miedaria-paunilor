import { useTranslation } from 'react-i18next';

export type Language = 'en' | 'ro';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'ro'] as const;
export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: string): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export function useLanguage(): Language {
  const { i18n } = useTranslation();
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}
