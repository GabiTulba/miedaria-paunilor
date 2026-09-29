import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { ApiError } from '../types/api';
import { useConsent } from '../hooks/useConsent';
import { LocalizedLink } from './LocalizedLink';
import { track } from '../lib/analytics';
import { isPopupSuppressed, rememberDismissal, rememberSubscription } from '../lib/newsletterPopup';
import './NewsletterPopup.css';

const ENGAGEMENT_DELAY_MS = 25_000;
const ENGAGEMENT_SCROLL_RATIO = 0.4;

type Status = 'idle' | 'submitting' | 'success' | 'error';

function scrolledEnough(): boolean {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    return scrollable <= 0 || window.scrollY / scrollable >= ENGAGEMENT_SCROLL_RATIO;
}

/// Resolves to true once the visitor has both spent ENGAGEMENT_DELAY_MS on
/// the page and scrolled through ENGAGEMENT_SCROLL_RATIO of it.
function useEngaged(enabled: boolean): boolean {
    const [delayPassed, setDelayPassed] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        const timer = window.setTimeout(() => setDelayPassed(true), ENGAGEMENT_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [enabled]);

    useEffect(() => {
        if (!enabled || scrolled) return;
        const check = () => {
            if (scrolledEnough()) setScrolled(true);
        };
        check();
        window.addEventListener('scroll', check, { passive: true });
        return () => window.removeEventListener('scroll', check);
    }, [enabled, scrolled]);

    return delayPassed && scrolled;
}

/// Small corner card inviting newsletter sign-up. Rendered only once the
/// age gate and the cookie banner are out of the way; never blocks the page.
function NewsletterPopup() {
    const { t } = useTranslation();
    const consent = useConsent();
    const [suppressed, setSuppressed] = useState(isPopupSuppressed);
    const engaged = useEngaged(consent !== null && !suppressed);
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [errorKey, setErrorKey] = useState<'invalidEmail' | 'tooManyRequests' | 'generic'>('generic');

    const visible = consent !== null && !suppressed && engaged;

    const close = useCallback(() => {
        if (consent && status !== 'success') {
            rememberDismissal(consent);
            track({ event: 'newsletter_popup', outcome: 'dismissed' });
        }
        setSuppressed(true);
    }, [consent, status]);

    useEffect(() => {
        if (visible) track({ event: 'newsletter_popup', outcome: 'shown' });
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [visible, close]);

    if (!visible || !consent) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus('submitting');
        try {
            await api.subscribeNewsletter(email);
            rememberSubscription(consent);
            track({ event: 'newsletter_popup', outcome: 'subscribed' });
            setStatus('success');
        } catch (err) {
            const httpStatus = (err as ApiError).response?.status;
            setErrorKey(httpStatus === 400 ? 'invalidEmail' : httpStatus === 429 ? 'tooManyRequests' : 'generic');
            setStatus('error');
        }
    };

    return (
        <aside className="newsletter-popup" role="dialog" aria-labelledby="newsletter-popup-title">
            <button type="button" className="newsletter-popup-close" onClick={close} aria-label={t('common.close')}>
                ×
            </button>
            <h2 id="newsletter-popup-title">{t('newsletter.popup.title')}</h2>
            {status === 'success' ? (
                <p role="status">{t('newsletter.popup.success')}</p>
            ) : (
                <>
                    <p>{t('newsletter.popup.description')}</p>
                    <form className="newsletter-popup-form" onSubmit={handleSubmit}>
                        <label htmlFor="newsletter-popup-email" className="visually-hidden">
                            {t('newsletter.popup.emailLabel')}
                        </label>
                        <input
                            id="newsletter-popup-email"
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="email"
                            placeholder={t('newsletter.popup.emailPlaceholder')}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                        <button type="submit" className="button" disabled={status === 'submitting'}>
                            {t('newsletter.popup.submit')}
                        </button>
                    </form>
                    {status === 'error' && (
                        <p className="newsletter-popup-error" role="alert">{t(`newsletter.errors.${errorKey}`)}</p>
                    )}
                    <p className="newsletter-popup-note">
                        {t('newsletter.popup.note')}{' '}
                        <LocalizedLink to="/privacy-policy">{t('newsletter.popup.privacyLink')}</LocalizedLink>
                    </p>
                </>
            )}
        </aside>
    );
}

export default NewsletterPopup;
