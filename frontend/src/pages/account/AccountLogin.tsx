import { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import TextInput from '../../components/forms/TextInput';
import GoogleButton, { OrDivider } from '../../components/GoogleButton';
import { LocalizedLink } from '../../components/LocalizedLink';
import { useAccount } from '../../context/AccountContext';
import { useLocalizedNavigate } from '../../hooks/useLocalizedNavigate';
import { useShakeOnError } from '../../hooks/useShakeOnError';
import { useSignInProviders } from '../../hooks/useSignInProviders';
import { api } from '../../lib/api';
import { safeReturnPath } from '../../lib/accountRedirect';
import AccountLayout from './AccountLayout';
import { accountErrorKey, AccountErrorKey } from './accountErrors';

function AccountLogin() {
    const { t } = useTranslation();
    const { account, setAccount } = useAccount();
    const navigate = useLocalizedNavigate();
    const [searchParams] = useSearchParams();
    const next = safeReturnPath(searchParams.get('next')) ?? '/account';
    const providers = useSignInProviders();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<AccountErrorKey | null>(null);
    const [errorCount, setErrorCount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    useShakeOnError(formRef, errorCount);

    if (account) return <Navigate to={next} replace />;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            setAccount(await api.accountLogin(email, password));
            navigate(next, { replace: true });
        } catch (err) {
            setError(accountErrorKey(err));
            setErrorCount(n => n + 1);
            setPassword('');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AccountLayout title={t('account.login.title')}>
            {providers.google && (
                <>
                    <GoogleButton intent="sign-in" next={next} label={t('account.google.continue')} />
                    <OrDivider />
                </>
            )}
            <form ref={formRef} className="account-form" onSubmit={handleSubmit} noValidate>
                <TextInput
                    id="account-email"
                    label={t('account.fields.email')}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <TextInput
                    id="account-password"
                    label={t('account.fields.password')}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {error && <p className="account-error" role="alert">{t(`account.errors.${error}`)}</p>}
                <button type="submit" disabled={submitting || !email || !password}>
                    {t('account.login.submit')}
                </button>
            </form>
            <p className="account-links">
                <LocalizedLink to="/account/forgot-password">{t('account.login.forgot')}</LocalizedLink>
                <LocalizedLink to="/account/register">{t('account.login.register')}</LocalizedLink>
            </p>
        </AccountLayout>
    );
}

export default AccountLogin;
