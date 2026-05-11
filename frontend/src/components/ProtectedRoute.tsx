import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function ProtectedRoute() {
    const { auth, loading } = useContext(AuthContext);

    if (loading) {
        // Defer the redirect decision until /admin/me has resolved, so a hard
        // reload on a deep admin link doesn't bounce the user to the login
        // page before the session probe completes.
        return null;
    }

    if (!auth) {
        return <Navigate to="/admin" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;
