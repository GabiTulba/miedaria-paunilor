import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { ApiError } from '../types/api';
import { useConsumedParams } from '../hooks/useConsumedParams';
import NewsletterLayout from './NewsletterLayout';

type Status = 'pending' | 'confirmed' | 'invalid' | 'error';

/// Landing page of the confirmation email's link. Confirming takes a POST
/// from this page rather than a plain GET, so link scanners in mail
/// filters that prefetch URLs cannot confirm on the recipient's behalf.
function NewsletterConfirm() {
    const { t } = useTranslation();
    const { token } = useConsumedParams(['token'] as const);
    const [status, setStatus] = useState<Status>(token ? 'pending' : 'invalid');
    const requested = useRef(false);

    useEffect(() => {
        if (!token || requested.current) return;
        requested.current = true;
        api.confirmNewsletter(token)
            .then(() => setStatus('confirmed'))
            .catch((err: ApiError) => setStatus(err.response?.status === 404 ? 'invalid' : 'error'));
    }, [token]);

    return (
        <NewsletterLayout title={t('newsletter.confirm.title')}>
            <p role={status === 'pending' ? undefined : 'status'}>{t(`newsletter.confirm.${status}`)}</p>
        </NewsletterLayout>
    );
}

export default NewsletterConfirm;
