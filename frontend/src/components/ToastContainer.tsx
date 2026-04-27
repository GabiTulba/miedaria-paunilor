import { useToast } from '../context/ToastContext';
import type { ToastType } from '../context/ToastContext';
import './ToastContainer.css';

const ICONS: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
};

export default function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container" aria-live="polite" aria-atomic="false">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    role="status"
                >
                    <span className="toast-icon">{ICONS[toast.type]}</span>
                    <span className="toast-message">{toast.message}</span>
                    <button
                        className="toast-close"
                        onClick={() => removeToast(toast.id)}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
