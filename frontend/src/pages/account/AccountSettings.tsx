import { FormEvent, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TextInput from '../../components/forms/TextInput';
import GoogleButton from '../../components/GoogleButton';
import { useAccount } from '../../context/AccountContext';
import { useLocalizedNavigate } from '../../hooks/useLocalizedNavigate';
import { useSignInProviders } from '../../hooks/useSignInProviders';
import { api } from '../../lib/api';
import AccountLayout from './AccountLayout';
import AccountNav from './AccountNav';
import { accountErrorKey, AccountErrorKey } from './accountErrors';
import PasswordFields from './PasswordFields';
import { passwordsReady } from './passwordRules';

const SETTINGS_PATH = '/account/settings';

interface SettingsFormProps {
    id: string;
    title: string;
    description?: string;
    submitLabel: string;
    danger?: boolean;
    /// Extra fields shown above the confirmation.
    children?: ReactNode;
    canSubmit?: boolean;
    /// Always ask for the current password, even where Google could confirm.
    requirePassword?: boolean;
    /// Runs the action with the current password (undefined for an account
    /// without one); returns a success message, or nothing when the page
    /// moves on.
    onSubmit: (currentPassword: string | undefined) => Promise<string | void>;
}

/// Every settings action is confirmed, so a session left open on a shared
/// computer cannot take over the account: with the current password, or, for
/// an account without one, by signing in with Google again.
function SettingsForm({ id, title, description, submitLabel, danger, children, canSubmit = true, requirePassword, onSubmit }: SettingsFormProps) {
    const { t } = useTranslation();
    const { account } = useAccount();
    const [currentPassword, setCurrentPassword] = useState('');
    const [error, setError] = useState<AccountErrorKey | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const usesPassword = requirePassword || account?.has_password !== false;
    const reauthenticated = !!account?.reauthenticated_until && new Date(account.reauthenticated_until) > new Date();
    const confirmed = usesPassword ? currentPassword.length > 0 : reauthenticated;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setNotice(null);
        try {
            const message = await onSubmit(usesPassword ? currentPassword : undefined);
            if (message) setNotice(message);
            setCurrentPassword('');
        } catch (err) {
            setError(accountErrorKey(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className={`account-section${danger ? ' account-section-danger' : ''}`} aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`}>{title}</h2>
            {description && <p>{description}</p>}
            <form className="account-form" onSubmit={handleSubmit} noValidate>
                {children}
                {usesPassword ? (
                    <TextInput
                        id={`${id}-current-password`}
                        label={t('account.fields.currentPassword')}
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        required
                    />
                ) : !reauthenticated && (
                    <div className="account-reauth">
                        <p>{t('account.google.reauthPrompt')}</p>
                        <GoogleButton intent="reauth" next={SETTINGS_PATH} label={t('account.google.reauth')} />
                    </div>
                )}
                {error && <p className="account-error" role="alert">{t(`account.errors.${error}`)}</p>}
                {notice && <p className="account-notice" role="status">{notice}</p>}
                <button
                    type="submit"
                    className={danger ? 'button-danger' : undefined}
                    disabled={submitting || !confirmed || !canSubmit}
                >
                    {submitLabel}
                </button>
            </form>
        </section>
    );
}

function downloadJson(data: unknown, filename: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/// An account without a password gets one through the emailed reset link,
/// which also proves it owns its address.
function SetPasswordSection() {
    const { t } = useTranslation();
    const { account } = useAccount();
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<AccountErrorKey | null>(null);

    const request = async () => {
        if (!account) return;
        setError(null);
        try {
            await api.accountRequestPasswordReset(account.email);
            setSent(true);
        } catch (err) {
            setError(accountErrorKey(err));
        }
    };

    return (
        <section className="account-section" aria-labelledby="set-password-title">
            <h2 id="set-password-title">{t('account.settings.password.title')}</h2>
            <p>{t('account.settings.password.none')}</p>
            {error && <p className="account-error" role="alert">{t(`account.errors.${error}`)}</p>}
            {sent ? (
                <p className="account-notice" role="status">{t('account.settings.password.linkSent')}</p>
            ) : (
                <button type="button" className="button-secondary" onClick={request}>
                    {t('account.settings.password.sendLink')}
                </button>
            )}
        </section>
    );
}

function GoogleSection() {
    const { t } = useTranslation();
    const { account, setAccount } = useAccount();
    if (!account) return null;

    if (!account.google_linked) {
        return (
            <section className="account-section" aria-labelledby="google-title">
                <h2 id="google-title">{t('account.google.title')}</h2>
                <p>{t('account.google.connectDescription')}</p>
                <GoogleButton intent="link" next={SETTINGS_PATH} label={t('account.google.connect')} />
            </section>
        );
    }
    if (!account.has_password) {
        return (
            <section className="account-section" aria-labelledby="google-title">
                <h2 id="google-title">{t('account.google.title')}</h2>
                <p>{t('account.google.connectedOnly')}</p>
            </section>
        );
    }
    return (
        <SettingsForm
            id="google"
            title={t('account.google.title')}
            description={t('account.google.connected')}
            submitLabel={t('account.google.disconnect')}
            requirePassword
            onSubmit={async currentPassword => {
                await api.unlinkGoogle(currentPassword ?? '');
                setAccount({ ...account, google_linked: false });
                return t('account.google.disconnected');
            }}
        />
    );
}

function AccountSettings() {
    const { t } = useTranslation();
    const { account, setAccount } = useAccount();
    const providers = useSignInProviders();
    const navigate = useLocalizedNavigate();
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    const endSession = () => {
        setAccount(null);
        navigate('/', { replace: true });
    };

    return (
        <AccountLayout title={t('account.settings.title')} wide>
            <AccountNav />
            <SettingsForm
                id="change-email"
                title={t('account.settings.email.title')}
                description={t('account.settings.email.description', { email: account?.email })}
                submitLabel={t('account.settings.email.submit')}
                canSubmit={newEmail.length > 0}
                onSubmit={async currentPassword => {
                    await api.accountChangeEmail(newEmail, currentPassword);
                    setNewEmail('');
                    return t('account.settings.email.sent');
                }}
            >
                <TextInput
                    id="change-email-new"
                    label={t('account.fields.newEmail')}
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    required
                />
            </SettingsForm>

            {account?.has_password ? (
                <SettingsForm
                    id="change-password"
                    title={t('account.settings.password.title')}
                    description={t('account.settings.password.description')}
                    submitLabel={t('account.settings.password.submit')}
                    canSubmit={passwordsReady(newPassword, confirmation)}
                    onSubmit={async currentPassword => {
                        await api.accountChangePassword(currentPassword ?? '', newPassword);
                        setNewPassword('');
                        setConfirmation('');
                        return t('account.settings.password.done');
                    }}
                >
                    <PasswordFields
                        password={newPassword}
                        confirmation={confirmation}
                        onPasswordChange={setNewPassword}
                        onConfirmationChange={setConfirmation}
                    />
                </SettingsForm>
            ) : (
                <SetPasswordSection />
            )}

            {(providers.google || account?.google_linked) && <GoogleSection />}

            <section className="account-section" aria-labelledby="sessions-title">
                <h2 id="sessions-title">{t('account.settings.sessions.title')}</h2>
                <p>{t('account.settings.sessions.description')}</p>
                <button
                    type="button"
                    className="button-secondary"
                    onClick={async () => {
                        await api.accountLogoutEverywhere();
                        endSession();
                    }}
                >
                    {t('account.settings.sessions.submit')}
                </button>
            </section>

            <SettingsForm
                id="export"
                title={t('account.settings.export.title')}
                description={t('account.settings.export.description')}
                submitLabel={t('account.settings.export.submit')}
                onSubmit={async currentPassword => {
                    downloadJson(await api.accountExport(currentPassword), 'miedaria-paunilor-account.json');
                }}
            />

            <SettingsForm
                id="delete-account"
                title={t('account.settings.delete.title')}
                description={t('account.settings.delete.description')}
                submitLabel={t('account.settings.delete.submit')}
                danger
                canSubmit={confirmDelete}
                onSubmit={async currentPassword => {
                    await api.deleteAccount(currentPassword);
                    endSession();
                }}
            >
                <label className="account-checkbox">
                    <input type="checkbox" checked={confirmDelete} onChange={e => setConfirmDelete(e.target.checked)} />
                    {t('account.settings.delete.confirm')}
                </label>
            </SettingsForm>
        </AccountLayout>
    );
}

export default AccountSettings;
