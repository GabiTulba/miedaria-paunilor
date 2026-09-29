import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizedLink } from '../../components/LocalizedLink';
import { useAccount } from '../../context/AccountContext';
import { useConsumedParams } from '../../hooks/useConsumedParams';
import { useLocalizedNavigate } from '../../hooks/useLocalizedNavigate';
import { api } from '../../lib/api';
import AccountLayout from './AccountLayout';
import { accountErrorKey, AccountErrorKey } from './accountErrors';
import PasswordFields from './PasswordFields';
import { passwordsReady } from './passwordRules';

/// Target of the registration and password-reset emails. The token is read
/// once and removed from the address bar; the password is only sent on an
/// explicit submit, so a link scanner opening the page changes nothing.
function AccountSetPassword() {
    const { t } = useTranslation();
    const { token } = useConsumedParams(['token'] as const);
    const { setAccount } = useAccount();
    const navigate = useLocalizedNavigate();
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState<AccountErrorKey | null>(token ? null : 'invalidLink');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setSubmitting(true);
        setError(null);
        try {
            setAccount(await api.accountSetPassword(token, password));
            navigate('/account', { replace: true });
        } catch (err) {
            setError(accountErrorKey(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AccountLayout title={t('account.setPassword.title')}>
            {error === 'invalidLink' ? (
                <>
                    <p role="alert" className="account-error">{t('account.errors.invalidLink')}</p>
                    <p className="account-links">
                        <LocalizedLink to="/account/forgot-password">{t('account.setPassword.newLink')}</LocalizedLink>
                    </p>
                </>
            ) : (
                <form className="account-form" onSubmit={handleSubmit} noValidate>
                    <p>{t('account.setPassword.intro')}</p>
                    <PasswordFields
                        password={password}
                        confirmation={confirmation}
                        onPasswordChange={setPassword}
                        onConfirmationChange={setConfirmation}
                    />
                    {error && <p className="account-error" role="alert">{t(`account.errors.${error}`)}</p>}
                    <button type="submit" disabled={submitting || !passwordsReady(password, confirmation)}>
                        {t('account.setPassword.submit')}
                    </button>
                </form>
            )}
        </AccountLayout>
    );
}

export default AccountSetPassword;
