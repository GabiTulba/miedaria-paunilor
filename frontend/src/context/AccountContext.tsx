import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AccountProfile } from '../types/generated/AccountProfile';

interface AccountContextType {
    account: AccountProfile | null;
    loading: boolean;
    setAccount: (account: AccountProfile | null) => void;
    logout: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType>({
    account: null,
    loading: true,
    setAccount: () => {},
    logout: async () => {},
});

/// Customer session state. The session cookie is httpOnly, so /account/me
/// (which answers null when logged out) is the source of truth. Entirely
/// separate from the admin `AuthProvider`.
export function AccountProvider({ children }: { children: ReactNode }) {
    const [account, setAccount] = useState<AccountProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        api.accountMe(controller.signal)
            .then(setAccount)
            .catch(() => setAccount(null))
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.accountLogout();
        } finally {
            setAccount(null);
        }
    }, []);

    return (
        <AccountContext.Provider value={{ account, loading, setAccount, logout }}>
            {children}
        </AccountContext.Provider>
    );
}

export const useAccount = () => useContext(AccountContext);
