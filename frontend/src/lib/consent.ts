import { deleteCookie, getCookie, setCookie, SIX_MONTHS_SECONDS } from './cookies';

/// Cookie-consent state. The consent choice itself and the age-gate
/// confirmation are strictly necessary and stored regardless of the choice;
/// the cart and language cookies are only written when consent is 'accepted'
/// (see CartContext and detectInitialLang).

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
        deleteCookie('cart');
        deleteCookie('lang');
        try {
            window.localStorage?.removeItem('i18nextLng');
        } catch {
            // localStorage may be unavailable (private mode, etc.)
        }
    }
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}
