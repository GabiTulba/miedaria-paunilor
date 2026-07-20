import { useTranslation } from 'react-i18next';
import { setConsent } from '../lib/consent';
import { useConsent } from '../hooks/useConsent';
import './CookieConsentBanner.css';

/// Accept/Decline banner for the site's functional cookies (cart, language).
/// Declining keeps those features session-only; the choice itself is stored
/// for 6 months either way.
function CookieConsentBanner() {
    const consent = useConsent();
    const { t } = useTranslation();

    if (consent !== null) return null;

    return (
        <div className="cookie-banner" role="region" aria-label={t('cookieConsent.ariaLabel')}>
            <p className="cookie-banner-message">{t('cookieConsent.message')}</p>
            <div className="cookie-banner-actions">
                <button className="button cookie-banner-accept" onClick={() => setConsent('accepted')}>
                    {t('cookieConsent.accept')}
                </button>
                <button className="button cookie-banner-decline" onClick={() => setConsent('declined')}>
                    {t('cookieConsent.decline')}
                </button>
            </div>
        </div>
    );
}

export default CookieConsentBanner;
