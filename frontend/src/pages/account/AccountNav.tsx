import { useTranslation } from 'react-i18next';
import { LocalizedNavLink } from '../../components/LocalizedLink';
import { useAccount } from '../../context/AccountContext';
import { useLocalizedNavigate } from '../../hooks/useLocalizedNavigate';

/// Navigation between the logged-in account pages.
function AccountNav() {
    const { t } = useTranslation();
    const { account, logout } = useAccount();
    const navigate = useLocalizedNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <nav className="account-nav" aria-label={t('account.nav.label')}>
            <span className="account-nav-email">{account?.email}</span>
            <LocalizedNavLink to="/account" end>{t('account.nav.orders')}</LocalizedNavLink>
            <LocalizedNavLink to="/account/settings">{t('account.nav.settings')}</LocalizedNavLink>
            <button type="button" className="button-secondary" onClick={handleLogout}>{t('account.nav.logout')}</button>
        </nav>
    );
}

export default AccountNav;
