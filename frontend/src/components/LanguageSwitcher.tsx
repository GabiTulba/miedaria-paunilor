import { useTranslation } from 'react-i18next';
import { useLanguage, Language } from '../hooks/useLanguage';

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const language = useLanguage();

  const changeLanguage = (lng: Language) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher">
      <button
        className={`language-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => changeLanguage('en')}
        title="English"
        aria-label="Switch to English"
      >
        <span className="flag" aria-hidden="true">🇬🇧</span>
        <span className="language-code">EN</span>
      </button>
      <button
        className={`language-btn ${language === 'ro' ? 'active' : ''}`}
        onClick={() => changeLanguage('ro')}
        title="Română"
        aria-label="Switch to Romanian"
      >
        <span className="flag" aria-hidden="true">🇷🇴</span>
        <span className="language-code">RO</span>
      </button>
    </div>
  );
}

export default LanguageSwitcher;
