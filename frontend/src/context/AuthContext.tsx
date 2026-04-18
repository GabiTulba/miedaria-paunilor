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

function isValidJwtFormat(value: string): boolean {
    const parts = value.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenInternal] = useState<string | null>(() => {
        const stored = localStorage.getItem('jwt_token');
        if (!stored || !isValidJwtFormat(stored)) {
            if (stored) localStorage.removeItem('jwt_token');
            return null;
        }
        return stored;
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
