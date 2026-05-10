import { RefObject, useEffect } from 'react';

// Add a transient `shake` class to the form element when the error count rises,
// removing it once the CSS animation completes. Encapsulates the inline blocks
// previously duplicated in ProductForm/BlogForm/AdminLogin.
export function useShakeOnError<T extends HTMLElement>(
    elementRef: RefObject<T | null>,
    errorCount: number,
): void {
    useEffect(() => {
        if (errorCount <= 0) return;
        const node = elementRef.current;
        if (!node) return;
        node.classList.add('shake');
        const handler = () => node.classList.remove('shake');
        node.addEventListener('animationend', handler, { once: true });
        return () => node.removeEventListener('animationend', handler);
    }, [errorCount, elementRef]);
}
