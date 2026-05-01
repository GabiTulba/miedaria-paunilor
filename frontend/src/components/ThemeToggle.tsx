import { useTheme, ThemePreference } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import './ThemeToggle.css';

const POSITIONS: ThemePreference[] = ['light', 'system', 'dark'];

const ICON_URLS: Record<ThemePreference, string> = {
    light: '/icon-sun.svg',
    system: '/icon-system.svg',
    dark: '/icon-moon.svg',
};

export default function ThemeToggle() {
    const { preference, setPreference } = useTheme();
    const { t } = useTranslation();

    const positionIndex = POSITIONS.indexOf(preference);

    return (
        <div
            className="theme-slider"
            role="radiogroup"
            aria-label={t('theme.label', 'Theme')}
        >
            {POSITIONS.map((pos) => (
                <button
                    key={pos}
                    className={`theme-slider-option ${preference === pos ? 'active' : ''}`}
                    onClick={() => setPreference(pos)}
                    role="radio"
                    aria-checked={preference === pos}
                    aria-label={t(`theme.${pos}`)}
                    title={t(`theme.${pos}`)}
                >
                    <span
                        className="theme-slider-icon"
                        style={{
                            maskImage: `url(${ICON_URLS[pos]})`,
                            WebkitMaskImage: `url(${ICON_URLS[pos]})`,
                            maskSize: 'contain',
                            WebkitMaskSize: 'contain',
                            maskRepeat: 'no-repeat',
                            WebkitMaskRepeat: 'no-repeat',
                            maskPosition: 'center',
                            WebkitMaskPosition: 'center',
                            backgroundColor: 'currentColor',
                            display: 'inline-block',
                        }}
                    />
                </button>
            ))}
            <div
                className="theme-slider-indicator"
                style={{ transform: `translateX(${positionIndex * 30}px) translateY(-50%)` }}
            />
        </div>
    );
}
