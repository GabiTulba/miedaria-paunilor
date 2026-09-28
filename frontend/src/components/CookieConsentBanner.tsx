import { useLayoutEffect, useRef } from 'react';
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
    const bannerRef = useRef<HTMLDivElement>(null);
    const visible = consent === null;

    // Reserve room at the bottom of the page for the fixed banner so it never
    // hides the footer or the last buttons on the page.
    useLayoutEffect(() => {
        const root = document.documentElement;
        const banner = bannerRef.current;
        if (!visible || !banner) return;
        const update = () => root.style.setProperty('--cookie-banner-height', `${banner.offsetHeight}px`);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(banner);
        root.classList.add('has-cookie-banner');
        return () => {
            observer.disconnect();
            root.classList.remove('has-cookie-banner');
            root.style.removeProperty('--cookie-banner-height');
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <div ref={bannerRef} className="cookie-banner" role="region" aria-label={t('cookieConsent.ariaLabel')}>
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
