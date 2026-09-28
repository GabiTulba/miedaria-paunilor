import { createContext, useEffect, useRef, useState, ReactNode } from 'react';
import { LocalizedProduct } from '../types';
import { api } from '../lib/api';
import { deleteCookie, getCookie, setCookie, ONE_WEEK_SECONDS } from '../lib/cookies';
import { MAX_ORDER_BOTTLES } from '../utils/stockAvailability';
import { releaseAbandonedCheckout } from '../lib/pendingCheckout';

export interface CartItem extends LocalizedProduct {
    quantity: number;
    availableStock: number;
}

interface CartContextType {
    cartItems: CartItem[];
    /** Returns how many bottles were actually added after stock and order-size limits. */
    addToCart: (product: LocalizedProduct, quantity: number, availableStock: number) => number;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number, availableStock?: number) => void;
    updateStock: (productId: string, newAvailableStock: number) => void;
    updateProduct: (productId: string, updates: Partial<LocalizedProduct>) => void;
    clearCart: () => void;
    itemCount: number;
}

export const CartContext = createContext<CartContextType>({
    cartItems: [],
    addToCart: () => 0,
    removeFromCart: () => {},
    updateQuantity: () => {},
    updateStock: () => {},
    updateProduct: () => {},
    clearCart: () => {},
    itemCount: 0,
});

const CART_COOKIE = 'cart';

/// Compact persisted form: `p` = product_id, `q` = quantity. Product data is
/// re-fetched on hydration so prices/stock are always current.
interface PersistedCartEntry {
    p: string;
    q: number;
}

/** Largest quantity `productId` may have without exceeding its stock or the order bottle cap. */
function maxQuantityFor(items: CartItem[], productId: string, stock: number): number {
    const otherBottles = items
        .filter(item => item.product_id !== productId)
        .reduce((sum, item) => sum + item.quantity, 0);
    return Math.max(0, Math.min(stock, MAX_ORDER_BOTTLES - otherBottles));
}

function readPersistedCart(): PersistedCartEntry[] {
    const raw = getCookie(CART_COOKIE);
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (e): e is PersistedCartEntry =>
                typeof e === 'object' && e !== null &&
                typeof (e as PersistedCartEntry).p === 'string' &&
                typeof (e as PersistedCartEntry).q === 'number' &&
                (e as PersistedCartEntry).q > 0
        );
    } catch {
        return [];
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    // Persisting before hydration finishes would overwrite the cookie with the
    // initial empty cart on every page load.
    const [isHydrated, setIsHydrated] = useState(false);
    // Set by clearCart so an in-flight hydration can't resurrect a cart the
    // user just cleared (e.g. CheckoutSuccess clears on mount, mid-hydration).
    const skipHydrationRef = useRef(false);

    // On load, and when the browser restores this page from the back/forward
    // cache after the customer left Stripe with Back.
    useEffect(() => {
        releaseAbandonedCheckout();
        const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) releaseAbandonedCheckout();
        };
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, []);

    useEffect(() => {
        const persisted = readPersistedCart();
        if (persisted.length === 0) {
            setIsHydrated(true);
            return;
        }

        const controller = new AbortController();
        const hydrate = async () => {
            const settled = await Promise.allSettled(
                persisted.map(entry => api.getProductById(entry.p, controller.signal))
            );
            if (controller.signal.aborted || skipHydrationRef.current) return;

            const restored: CartItem[] = [];
            settled.forEach((result, i) => {
                if (result.status !== 'fulfilled') return;
                const product = result.value.product;
                const stock = product.bottle_count;
                const quantity = Math.min(persisted[i].q, maxQuantityFor(restored, product.product_id, stock));
                if (quantity <= 0) return;
                restored.push({
                    ...product,
                    quantity,
                    availableStock: stock,
                });
            });

            // Items added while hydration was in flight take precedence.
            setCartItems(prev => [
                ...prev,
                ...restored.filter(r => !prev.some(item => item.product_id === r.product_id)),
            ]);
            setIsHydrated(true);
        };

        hydrate().catch(err => {
            console.error('Failed to restore cart:', err);
            setIsHydrated(true);
        });
        return () => controller.abort();
    }, []);

    // The cart cookie is strictly necessary (it only holds what the customer
    // put in the cart), so it is kept regardless of the cookie-consent choice.
    useEffect(() => {
        if (!isHydrated) return;
        if (cartItems.length === 0) {
            deleteCookie(CART_COOKIE);
            return;
        }
        const entries: PersistedCartEntry[] = cartItems.map(item => ({
            p: item.product_id,
            q: item.quantity,
        }));
        // Rewritten on every change, so the 7-day expiry slides with activity.
        setCookie(CART_COOKIE, JSON.stringify(entries), ONE_WEEK_SECONDS);
    }, [cartItems, isHydrated]);

    const addToCart = (product: LocalizedProduct, quantity: number, availableStock: number) => {
        const stock = availableStock ?? product.bottle_count;
        const current = cartItems.find(item => item.product_id === product.product_id)?.quantity ?? 0;
        const newQuantity = Math.min(current + quantity, maxQuantityFor(cartItems, product.product_id, stock));
        if (newQuantity <= current) return 0;
        setCartItems(prevItems => {
            if (prevItems.some(item => item.product_id === product.product_id)) {
                return prevItems.map(item =>
                    item.product_id === product.product_id
                        ? { ...item, quantity: newQuantity, availableStock: stock }
                        : item
                );
            }
            return [...prevItems, { ...product, quantity: newQuantity, availableStock: stock }];
        });
        return newQuantity - current;
    };

    const removeFromCart = (productId: string) => {
        setCartItems(prevItems => prevItems.filter(item => item.product_id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number, availableStock?: number) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCartItems(prevItems =>
            prevItems.map(item => {
                if (item.product_id === productId) {
                    const stock = availableStock ?? item.availableStock;
                    return { ...item, quantity: Math.min(quantity, maxQuantityFor(prevItems, productId, stock)) };
                }
                return item;
            })
        );
    };

    const updateStock = (productId: string, newAvailableStock: number) => {
        setCartItems(prevItems =>
            prevItems.map(item => {
                if (item.product_id === productId) {
                    return {
                        ...item,
                        availableStock: newAvailableStock,
                        quantity: Math.min(item.quantity, Math.max(newAvailableStock, 0)),
                    };
                }
                return item;
            })
        );
    };

    const updateProduct = (productId: string, updates: Partial<LocalizedProduct>) => {
        setCartItems(prevItems =>
            prevItems.map(item =>
                item.product_id === productId ? { ...item, ...updates } : item
            )
        );
    };

    const clearCart = () => {
        skipHydrationRef.current = true;
        deleteCookie(CART_COOKIE);
        setCartItems([]);
    };

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, updateStock, updateProduct, clearCart, itemCount }}>
            {children}
        </CartContext.Provider>
    );
}
