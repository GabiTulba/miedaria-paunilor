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

function decodeJwtExp(value: string): number | null {
    const parts = value.split('.');
    if (parts.length !== 3 || parts.some(part => part.length === 0)) return null;
    try {
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
        const json = JSON.parse(atob(padded));
        return typeof json.exp === 'number' ? json.exp : null;
    } catch {
        return null;
    }
}

function isTokenStillValid(value: string): boolean {
    const exp = decodeJwtExp(value);
    if (exp === null) return false;
    return exp * 1000 > Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenInternal] = useState<string | null>(() => {
        const stored = localStorage.getItem('jwt_token');
        if (!stored || !isTokenStillValid(stored)) {
            if (stored) localStorage.removeItem('jwt_token');
            return null;
        }
        return stored;
    });

    useEffect(() => {
        if (!token) return;
        const exp = decodeJwtExp(token);
        if (exp === null) return;
        const msUntilExpiry = exp * 1000 - Date.now();
        if (msUntilExpiry <= 0) {
            localStorage.removeItem('jwt_token');
            setTokenInternal(null);
            return;
        }
        const timeoutId = window.setTimeout(() => {
            localStorage.removeItem('jwt_token');
            setTokenInternal(null);
        }, msUntilExpiry);
        return () => window.clearTimeout(timeoutId);
    }, [token]);

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
