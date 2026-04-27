import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type: ToastType, duration?: number) => void;
    removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType>({
    toasts: [],
    showToast: () => {},
    removeToast: () => {},
});

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType, duration = DEFAULT_DURATION) => {
        const id = nextId.current++;
        setToasts(prev => {
            const next = [...prev, { id, message, type, duration }];
            if (next.length > MAX_TOASTS) {
                return next.slice(next.length - MAX_TOASTS);
            }
            return next;
        });
        setTimeout(() => removeToast(id), duration);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}
