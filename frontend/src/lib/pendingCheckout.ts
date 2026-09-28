import { api } from './api';

/// sessionStorage key holding the order id of a checkout handed to Stripe.
/// Present = the customer may have left Stripe without paying.
const PENDING_CHECKOUT_KEY = 'pending_checkout';
const CANCELLED_PARAM = 'checkout_cancelled';

export function rememberPendingCheckout(orderId: string): void {
    try {
        window.sessionStorage?.setItem(PENDING_CHECKOUT_KEY, orderId);
    } catch {
        // sessionStorage unavailable: the reservation sweeper releases it later.
    }
}

export function forgetPendingCheckout(): void {
    try {
        window.sessionStorage?.removeItem(PENDING_CHECKOUT_KEY);
    } catch {
        // ignore
    }
}

/// Releases the stock of a checkout the customer abandoned: either Stripe's
/// cancel link brought them back (`?checkout_cancelled=<id>`), or they came
/// back some other way (browser Back) with a pending checkout remembered in
/// this tab. Skipped on the success page, where the order was paid.
export function releaseAbandonedCheckout(): void {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.includes('/checkout/success')) {
        forgetPendingCheckout();
        return;
    }
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get(CANCELLED_PARAM);
    let fromStorage: string | null = null;
    try {
        fromStorage = window.sessionStorage?.getItem(PENDING_CHECKOUT_KEY) ?? null;
    } catch {
        // ignore
    }
    const orderId = fromUrl || fromStorage;
    if (fromUrl) {
        url.searchParams.delete(CANCELLED_PARAM);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (!orderId) return;
    forgetPendingCheckout();
    api.cancelCheckout(orderId).catch(err => console.error('Failed to release checkout:', err));
}
