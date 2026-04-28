import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import './ThemeToggle.css';

export default function ThemeToggle() {
    const { preference, resolvedTheme, cycleTheme } = useTheme();
    const { t } = useTranslation();

    const icon = resolvedTheme === 'dark' ? '☀' : '☾';
    const label = preference === 'system'
        ? t('theme.system')
        : preference === 'light'
            ? t('theme.light')
            : t('theme.dark');

    return (
        <button
            className="theme-toggle"
            onClick={cycleTheme}
            aria-label={label}
            title={label}
        >
            <span className="theme-toggle-icon">{icon}</span>
        </button>
    );
}
