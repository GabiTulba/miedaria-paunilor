import { useCallback } from 'react';
import { useLanguage } from './useLanguage';

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

export function useFormattedDate(options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS) {
  const language = useLanguage();

  return useCallback((dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(language, options);
    } catch {
      return dateStr;
    }
  }, [language, options]);
}
