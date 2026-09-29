import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TextInput from '../../components/forms/TextInput';
import GoogleButton, { OrDivider } from '../../components/GoogleButton';
import { LocalizedLink } from '../../components/LocalizedLink';
import { api } from '../../lib/api';
import { useSignInProviders } from '../../hooks/useSignInProviders';
import AccountLayout from './AccountLayout';
import { accountErrorKey, AccountErrorKey } from './accountErrors';

type Kind = 'register' | 'forgotPassword';

const SUBMIT: Record<Kind, (email: string) => Promise<null>> = {
    register: api.accountRegister,
    forgotPassword: api.accountRequestPasswordReset,
};

/// Registration and password reset both start with an address and continue
/// from an emailed link. The server answers the same whether or not the
/// address has an account, and so does this page.
function AccountEmailRequest({ kind }: { kind: Kind }) {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<AccountErrorKey | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const providers = useSignInProviders();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await SUBMIT[kind](email);
            setSent(true);
        } catch (err) {
            setError(accountErrorKey(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AccountLayout title={t(`account.${kind}.title`)}>
            {sent ? (
                <p role="status" className="account-notice">{t(`account.${kind}.sent`)}</p>
            ) : (
                <form className="account-form" onSubmit={handleSubmit} noValidate>
                    {kind === 'register' && providers.google && (
                        <>
                            <GoogleButton intent="sign-in" next="/account" label={t('account.google.continue')} />
                            <OrDivider />
                        </>
                    )}
                    <p>{t(`account.${kind}.intro`)}</p>
                    <TextInput
                        id="account-email"
                        label={t('account.fields.email')}
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    {error && <p className="account-error" role="alert">{t(`account.errors.${error}`)}</p>}
                    <button type="submit" disabled={submitting || !email}>{t(`account.${kind}.submit`)}</button>
                    {kind === 'register' && (
                        <p className="account-fine-print">
                            {t('account.register.privacy')}{' '}
                            <LocalizedLink to="/privacy-policy">{t('footer.privacyPolicy')}</LocalizedLink>
                        </p>
                    )}
                </form>
            )}
            <p className="account-links">
                <LocalizedLink to="/account/login">{t('account.login.back')}</LocalizedLink>
            </p>
        </AccountLayout>
    );
}

export default AccountEmailRequest;
