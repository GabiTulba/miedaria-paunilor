import { useTranslation } from 'react-i18next';
import TextInput from '../../components/forms/TextInput';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './passwordRules';

interface PasswordFieldsProps {
    password: string;
    confirmation: string;
    onPasswordChange: (value: string) => void;
    onConfirmationChange: (value: string) => void;
}

/// New password plus its repetition.
function PasswordFields({ password, confirmation, onPasswordChange, onConfirmationChange }: PasswordFieldsProps) {
    const { t } = useTranslation();
    const mismatch = confirmation.length > 0 && confirmation !== password;
    return (
        <>
            <TextInput
                id="account-new-password"
                label={t('account.fields.newPassword')}
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                helpText={t('account.fields.passwordHelp', { min: MIN_PASSWORD_LENGTH })}
                value={password}
                onChange={e => onPasswordChange(e.target.value)}
                required
            />
            <TextInput
                id="account-confirm-password"
                label={t('account.fields.confirmPassword')}
                type="password"
                autoComplete="new-password"
                maxLength={MAX_PASSWORD_LENGTH}
                error={mismatch ? t('account.errors.passwordMismatch') : undefined}
                value={confirmation}
                onChange={e => onConfirmationChange(e.target.value)}
                required
            />
        </>
    );
}

export default PasswordFields;
