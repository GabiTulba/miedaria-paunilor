import { RefObject, useEffect } from 'react';

interface UseFocusTrapDrawerOptions<TDrawer extends HTMLElement, TTrigger extends HTMLElement> {
    open: boolean;
    onClose: () => void;
    drawerRef: RefObject<TDrawer | null>;
    triggerRef: RefObject<TTrigger | null>;
    // CSS selector used to choose the element receiving initial focus.
    // Defaults to the first interactive element in the drawer.
    focusSelector?: string;
    // Limit drawer behavior to mobile widths (matches `(max-width: 1023px)`).
    // When false the lock + listeners run regardless of viewport. Defaults to true.
    mobileOnly?: boolean;
}

const DEFAULT_FOCUS_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Generic mobile drawer focus + body-scroll lock. While `open`, locks body scroll,
// focuses the first interactive element in the drawer, closes on Escape (returning
// focus to the trigger), and closes on outside pointer-down.
export function useFocusTrapDrawer<
    TDrawer extends HTMLElement,
    TTrigger extends HTMLElement,
>({
    open,
    onClose,
    drawerRef,
    triggerRef,
    focusSelector = DEFAULT_FOCUS_SELECTOR,
    mobileOnly = true,
}: UseFocusTrapDrawerOptions<TDrawer, TTrigger>): void {
    useEffect(() => {
        if (!open) return;

        if (mobileOnly && !window.matchMedia('(max-width: 1023px)').matches) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const target = drawerRef.current?.querySelector<HTMLElement>(focusSelector);
        target?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                triggerRef.current?.focus();
            }
        };

        const handlePointerDown = (e: PointerEvent) => {
            const node = e.target as Node;
            if (
                drawerRef.current &&
                !drawerRef.current.contains(node) &&
                triggerRef.current &&
                !triggerRef.current.contains(node)
            ) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose, drawerRef, triggerRef, focusSelector, mobileOnly]);
}
