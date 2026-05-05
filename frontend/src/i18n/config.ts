import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../hooks/useLanguage';
import { detectInitialLang } from '../lib/detectInitialLang';

import enTranslations from './locales/en.json';
import roTranslations from './locales/ro.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      ro: { translation: roTranslations },
    },
    lng: detectInitialLang(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: true,
    },
  });

export default i18n;
