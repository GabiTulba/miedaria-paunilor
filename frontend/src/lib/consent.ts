import { deleteCookie, getCookie, setCookie, SIX_MONTHS_SECONDS } from './cookies';

/// Cookie-consent state. The consent choice itself, the age-gate confirmation
/// and the cart are strictly necessary and stored regardless of the choice;
/// only the language preference (cookie + localStorage) is written when
/// consent is 'accepted' (see detectInitialLang).

export type ConsentChoice = 'accepted' | 'declined';

const CONSENT_COOKIE = 'cookie_consent';
export const CONSENT_CHANGED_EVENT = 'consent-changed';

export function getConsent(): ConsentChoice | null {
    const value = getCookie(CONSENT_COOKIE);
    return value === 'accepted' || value === 'declined' ? value : null;
}

export function setConsent(choice: ConsentChoice): void {
    setCookie(CONSENT_COOKIE, choice, SIX_MONTHS_SECONDS);
    if (choice === 'declined') {
        deleteCookie('lang');
        try {
            window.localStorage?.removeItem('i18nextLng');
        } catch {
            // localStorage may be unavailable (private mode, etc.)
        }
    }
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}

/// Forgets the stored choice so the banner asks again (the footer's "Cookie
/// settings" link). Consent must be as easy to withdraw as to give (GDPR 7(3)).
export function resetConsent(): void {
    deleteCookie(CONSENT_COOKIE);
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}
