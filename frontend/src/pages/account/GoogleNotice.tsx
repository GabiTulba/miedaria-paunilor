import { useTranslation } from 'react-i18next';
import { useConsumedParams } from '../../hooks/useConsumedParams';

const NOTICES = {
    linked: 'status',
    reauthenticated: 'status',
    'account-exists': 'alert',
    'linked-elsewhere': 'alert',
    'session-ended': 'alert',
    failed: 'alert',
} as const;

type Notice = keyof typeof NOTICES;

/// Reports the outcome of a Google sign-in, which the backend passes back as
/// `?google=`. A plain sign-in needs no message.
function GoogleNotice() {
    const { t } = useTranslation();
    const { google } = useConsumedParams(['google'] as const);
    if (!google || !(google in NOTICES)) return null;
    const notice = google as Notice;
    const role = NOTICES[notice];
    return (
        <p role={role} className={role === 'status' ? 'account-notice' : 'account-error'}>
            {t(`account.google.notices.${notice}`)}
        </p>
    );
}

export default GoogleNotice;
