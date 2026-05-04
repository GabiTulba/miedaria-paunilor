import { useCallback } from 'react';
import { useNavigate, NavigateOptions } from 'react-router-dom';
import { useLanguage } from './useLanguage';

export function withLangPrefix(to: string, lang: string): string {
  if (!to.startsWith('/')) return to;
  if (to.startsWith('/admin')) return to;
  if (/^\/(?:ro|en)(?:\/|$)/.test(to)) return to;
  return `/${lang}${to === '/' ? '' : to}`;
}

export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const lang = useLanguage();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }
      navigate(withLangPrefix(to, lang), options);
    },
    [navigate, lang]
  );
}
