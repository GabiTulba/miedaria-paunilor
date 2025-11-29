import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function ProtectedRoute() {
    const { token } = useContext(AuthContext);

    if (!token) {
        return <Navigate to="/admin" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;
