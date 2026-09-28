import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { ApiError } from '../types/api';
import { useConsumedParams } from '../hooks/useConsumedParams';
import NewsletterLayout from './NewsletterLayout';

type Status = 'ready' | 'submitting' | 'done' | 'invalid' | 'error';

/// Unsubscribe link target. Asks for one click instead of acting on load, so
/// a link scanner opening the page cannot unsubscribe anyone; mail clients
/// use the one-click List-Unsubscribe header instead.
function NewsletterUnsubscribe() {
    const { t } = useTranslation();
    const { id, token } = useConsumedParams(['id', 'token'] as const);
    const [status, setStatus] = useState<Status>(id && token ? 'ready' : 'invalid');

    const unsubscribe = async () => {
        if (!id || !token) return;
        setStatus('submitting');
        try {
            await api.unsubscribeNewsletter(id, token);
            setStatus('done');
        } catch (err) {
            setStatus((err as ApiError).response?.status === 400 ? 'invalid' : 'error');
        }
    };

    return (
        <NewsletterLayout title={t('newsletter.unsubscribe.title')}>
            {status === 'ready' || status === 'submitting' ? (
                <>
                    <p>{t('newsletter.unsubscribe.prompt')}</p>
                    <p>
                        <button type="button" className="button" onClick={unsubscribe} disabled={status === 'submitting'}>
                            {t('newsletter.unsubscribe.button')}
                        </button>
                    </p>
                </>
            ) : (
                <p role="status">{t(`newsletter.unsubscribe.${status}`)}</p>
            )}
        </NewsletterLayout>
    );
}

export default NewsletterUnsubscribe;
