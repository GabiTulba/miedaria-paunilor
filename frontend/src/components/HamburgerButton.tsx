import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

interface HamburgerButtonProps {
    open: boolean;
    onClick: () => void;
    // id of the drawer element this button controls (aria-controls)
    controls: string;
    className: string;
}

// Three-bar drawer toggle shared by the public header and the admin topbar.
export const HamburgerButton = forwardRef<HTMLButtonElement, HamburgerButtonProps>(
    function HamburgerButton({ open, onClick, controls, className }, ref) {
        const { t } = useTranslation();
        return (
            <button
                ref={ref}
                type="button"
                className={className}
                onClick={onClick}
                aria-expanded={open}
                aria-controls={controls}
                aria-label={t('navigation.toggleMenu')}
            >
                <span className="bar"></span>
                <span className="bar"></span>
                <span className="bar"></span>
            </button>
        );
    }
);
