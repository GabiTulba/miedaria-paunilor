import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface AuthContextType {
    token: string | null;
    setToken: (token: string | null) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    token: null,
    setToken: () => {},
    logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenInternal] = useState<string | null>(() => {
        return localStorage.getItem('jwt_token');
    });

    const setToken = useCallback((newToken: string | null) => {
        if (newToken) {
            localStorage.setItem('jwt_token', newToken);
        } else {
            localStorage.removeItem('jwt_token');
        }
        setTokenInternal(newToken);
    }, []);

    const logout = useCallback(() => {
        setToken(null);
    }, [setToken]);

    return (
        <AuthContext.Provider value={{ token, setToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// AuthChecker component to handle redirection if token is missing
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';

export function AuthChecker({ children }: { children: ReactNode }) {
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            navigate('/admin'); // Redirect to login page if no token
        }
    }, [token, navigate]);

    return <>{children}</>;
}

export const useAuth = () => {
    return useContext(AuthContext);
};
