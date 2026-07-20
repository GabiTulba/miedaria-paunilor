import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setCookie, SIX_MONTHS_SECONDS } from '../lib/cookies';
import './AgeGate.css';

export const AGE_VERIFIED_COOKIE = 'age_verified';

interface AgeGateProps {
    onConfirm: () => void;
}

/// Blocking 18+ overlay. Deliberately has no Escape/overlay-click dismissal:
/// the only ways forward are the two buttons. The confirmation cookie is
/// strictly necessary (legal requirement for an alcohol seller), so it is
/// written regardless of cookie consent.
function AgeGate({ onConfirm }: AgeGateProps) {
    const [denied, setDenied] = useState(false);
    const confirmRef = useRef<HTMLButtonElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        confirmRef.current?.focus();
    }, []);

    const handleConfirm = () => {
        setCookie(AGE_VERIFIED_COOKIE, '1', SIX_MONTHS_SECONDS);
        onConfirm();
    };

    return (
        <div className="age-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
            <div className="age-gate-card">
                {denied ? (
                    <>
                        <h2 id="age-gate-title">{t('ageGate.deniedTitle')}</h2>
                        <p>{t('ageGate.deniedMessage')}</p>
                    </>
                ) : (
                    <>
                        <h2 id="age-gate-title">{t('ageGate.title')}</h2>
                        <p>{t('ageGate.message')}</p>
                        <div className="age-gate-actions">
                            <button ref={confirmRef} className="button age-gate-confirm" onClick={handleConfirm}>
                                {t('ageGate.confirm')}
                            </button>
                            <button className="button age-gate-deny" onClick={() => setDenied(true)}>
                                {t('ageGate.deny')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default AgeGate;
