import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage, Language, isLanguage, SUPPORTED_LANGUAGES } from '../hooks/useLanguage';
import './LanguageSwitcher.css';

function LanguageSwitcher() {
  const language = useLanguage();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { pathname, search, hash } = useLocation();

  const switchLanguage = (lng: Language) => {
    if (lng === language) return;
    const segments = pathname.split('/');
    if (segments.length >= 2 && isLanguage(segments[1])) {
      segments[1] = lng;
      const target = `${segments.join('/') || '/'}${search}${hash}`;
      navigate(target, { replace: true });
      return;
    }
    void i18n.changeLanguage(lng);
    try {
      window.localStorage?.setItem('i18nextLng', lng);
    } catch {
      // ignore storage failures
    }
  };

  const labels: Record<Language, { flag: string; code: string; title: string; aria: string }> = {
    en: { flag: '🇬🇧', code: 'EN', title: 'English', aria: 'Switch to English' },
    ro: { flag: '🇷🇴', code: 'RO', title: 'Română', aria: 'Switch to Romanian' },
  };

  return (
    <div className="language-switcher">
      {SUPPORTED_LANGUAGES.map(lng => (
        <button
          key={lng}
          className={`language-btn ${language === lng ? 'active' : ''}`}
          onClick={() => switchLanguage(lng)}
          title={labels[lng].title}
          aria-label={labels[lng].aria}
        >
          <span className="flag" aria-hidden="true">{labels[lng].flag}</span>
          <span className="language-code">{labels[lng].code}</span>
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
