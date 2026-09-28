import type { ConsentChoice } from './consent';

/// Remembers that the visitor dismissed the newsletter popup (for
/// DISMISS_DAYS) or subscribed (for good). The flag is persisted in
/// localStorage only with cookie consent; otherwise it lives in
/// sessionStorage and is forgotten when the tab closes.
export const NEWSLETTER_POPUP_KEY = 'newsletter_popup';

const SUBSCRIBED = 'subscribed';
const DISMISS_DAYS = 60;
const DAY_MS = 86_400_000;

function storageFor(consent: ConsentChoice): Storage | undefined {
    try {
        return consent === 'accepted' ? window.localStorage : window.sessionStorage;
    } catch {
        return undefined;
    }
}

function read(storage: Storage | undefined): string | null {
    try {
        return storage?.getItem(NEWSLETTER_POPUP_KEY) ?? null;
    } catch {
        return null;
    }
}

function isSuppressed(value: string | null): boolean {
    if (value === SUBSCRIBED) return true;
    const dismissedUntil = Number(value);
    return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
}

export function isPopupSuppressed(): boolean {
    return isSuppressed(read(storageFor('accepted'))) || isSuppressed(read(storageFor('declined')));
}

function remember(consent: ConsentChoice, value: string): void {
    try {
        storageFor(consent)?.setItem(NEWSLETTER_POPUP_KEY, value);
    } catch {
        // Storage may be full or blocked; the popup then simply reappears.
    }
}

export function rememberDismissal(consent: ConsentChoice): void {
    remember(consent, String(Date.now() + DISMISS_DAYS * DAY_MS));
}

export function rememberSubscription(consent: ConsentChoice): void {
    remember(consent, SUBSCRIBED);
}
