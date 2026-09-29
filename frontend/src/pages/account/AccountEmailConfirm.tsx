import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizedLink } from '../../components/LocalizedLink';
import { useAccount } from '../../context/AccountContext';
import { useConsumedParams } from '../../hooks/useConsumedParams';
import { api } from '../../lib/api';
import AccountLayout from './AccountLayout';
import { accountErrorKey, AccountErrorKey } from './accountErrors';

type Status = 'ready' | 'submitting' | 'done';

/// Target of the email-change link. Asks for one click instead of acting on
/// load, so a link scanner opening the page cannot move the account.
function AccountEmailConfirm() {
    const { t } = useTranslation();
    const { token } = useConsumedParams(['token'] as const);
    const { account, setAccount } = useAccount();
    const [status, setStatus] = useState<Status>('ready');
    const [error, setError] = useState<AccountErrorKey | null>(token ? null : 'invalidLink');

    const confirm = async () => {
        if (!token) return;
        setStatus('submitting');
        try {
            await api.accountConfirmEmailChange(token);
            if (account) setAccount(await api.accountMe());
            setStatus('done');
        } catch (err) {
            setError(accountErrorKey(err));
            setStatus('ready');
        }
    };

    return (
        <AccountLayout title={t('account.emailConfirm.title')}>
            {error ? (
                <p role="alert" className="account-error">{t(`account.errors.${error}`)}</p>
            ) : status === 'done' ? (
                <p role="status" className="account-notice">{t('account.emailConfirm.done')}</p>
            ) : (
                <>
                    <p>{t('account.emailConfirm.prompt')}</p>
                    <p>
                        <button type="button" onClick={confirm} disabled={status === 'submitting'}>
                            {t('account.emailConfirm.submit')}
                        </button>
                    </p>
                </>
            )}
            <p className="account-links">
                <LocalizedLink to={account ? '/account/settings' : '/account/login'}>
                    {t(account ? 'account.nav.settings' : 'account.login.title')}
                </LocalizedLink>
            </p>
        </AccountLayout>
    );
}

export default AccountEmailConfirm;
