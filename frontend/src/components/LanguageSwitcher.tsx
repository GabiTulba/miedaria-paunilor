import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher">
      <button
        className={`language-btn ${i18n.language === 'en' ? 'active' : ''}`}
        onClick={() => changeLanguage('en')}
        title="English"
        aria-label="Switch to English"
      >
        <span className="flag" aria-hidden="true">🇬🇧</span>
        <span className="language-code">EN</span>
      </button>
      <button
        className={`language-btn ${i18n.language === 'ro' ? 'active' : ''}`}
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