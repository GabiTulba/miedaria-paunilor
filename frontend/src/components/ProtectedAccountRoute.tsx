import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAccount } from '../context/AccountContext';
import { withLangPrefix } from '../hooks/useLocalizedNavigate';
import { useLanguage } from '../hooks/useLanguage';

/// Sends logged-out visitors to the login page, which returns them here.
function ProtectedAccountRoute() {
    const { account, loading } = useAccount();
    const { pathname, search } = useLocation();
    const lang = useLanguage();

    if (loading) return null;
    if (!account) {
        const next = encodeURIComponent(pathname + search);
        return <Navigate to={`${withLangPrefix('/account/login', lang)}?next=${next}`} replace />;
    }
    return <Outlet />;
}

export default ProtectedAccountRoute;
