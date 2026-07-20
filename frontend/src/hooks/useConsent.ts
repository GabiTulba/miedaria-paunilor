import { useEffect, useState } from 'react';
import { CONSENT_CHANGED_EVENT, ConsentChoice, getConsent } from '../lib/consent';

/// Reactive view of the cookie-consent choice; re-renders when any component
/// calls setConsent().
export function useConsent(): ConsentChoice | null {
    const [consent, setConsentState] = useState<ConsentChoice | null>(() => getConsent());

    useEffect(() => {
        const sync = () => setConsentState(getConsent());
        window.addEventListener(CONSENT_CHANGED_EVENT, sync);
        return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
    }, []);

    return consent;
}
