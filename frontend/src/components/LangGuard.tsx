import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLanguage } from '../hooks/useLanguage';
import NotFound from '../pages/NotFound';

interface LangGuardProps {
  children: ReactNode;
}

function LangGuard({ children }: LangGuardProps) {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();

  if (!lang || !isLanguage(lang)) {
    return <NotFound />;
  }

  if (i18n.language !== lang) {
    void i18n.changeLanguage(lang);
    try {
      window.localStorage?.setItem('i18nextLng', lang);
    } catch {
      // ignore storage failures
    }
  }

  return <>{children}</>;
}

export default LangGuard;
