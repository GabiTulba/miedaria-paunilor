import { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { MeResponse } from '../types/generated/MeResponse';

export type AuthState = MeResponse;

interface AuthContextType {
    auth: AuthState | null;
    loading: boolean;
    setAuth: (auth: AuthState | null) => void;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
    auth: null,
    loading: true,
    setAuth: () => {},
    logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [loading, setLoading] = useState(true);

    // Probe the session on mount. The httpOnly cookie isn't readable from JS,
    // so /admin/me is the source of truth.
    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        api.adminMe(controller.signal)
            .then((me) => {
                if (!cancelled) setAuth(me);
            })
            .catch(() => {
                if (!cancelled) setAuth(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    // Server-driven auto-logout: clear local state when the cookie expires.
    useEffect(() => {
        if (!auth) return;
        const msUntilExpiry = auth.exp * 1000 - Date.now();
        if (msUntilExpiry <= 0) {
            setAuth(null);
            return;
        }
        const timeoutId = window.setTimeout(() => setAuth(null), msUntilExpiry);
        return () => window.clearTimeout(timeoutId);
    }, [auth]);

    const logout = useCallback(async () => {
        try {
            await api.adminLogout();
        } catch {
            // Best-effort: the cookie is gone client-side either way.
        }
        setAuth(null);
    }, []);

    return (
        <AuthContext.Provider value={{ auth, loading, setAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function AuthChecker({ children }: { children: ReactNode }) {
    const { auth, loading } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !auth) {
            navigate('/admin');
        }
    }, [auth, loading, navigate]);

    return <>{children}</>;
}

export const useAuth = () => useContext(AuthContext);
