import { createContext, useEffect, useRef, useState, ReactNode } from 'react';
import { LocalizedProduct } from '../types';
import { api } from '../lib/api';
import { deleteCookie, getCookie, setCookie, ONE_WEEK_SECONDS } from '../lib/cookies';
import { useConsent } from '../hooks/useConsent';

export interface CartItem extends LocalizedProduct {
    quantity: number;
    availableStock: number;
}

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (product: LocalizedProduct, quantity: number, availableStock: number) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number, availableStock?: number) => void;
    updateStock: (productId: string, newAvailableStock: number) => void;
    updateProduct: (productId: string, updates: Partial<LocalizedProduct>) => void;
    clearCart: () => void;
    itemCount: number;
}

export const CartContext = createContext<CartContextType>({
    cartItems: [],
    addToCart: () => {},
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
    const consent = useConsent();
    // Persisting before hydration finishes would overwrite the cookie with the
    // initial empty cart on every page load.
    const [isHydrated, setIsHydrated] = useState(false);
    // Set by clearCart so an in-flight hydration can't resurrect a cart the
    // user just cleared (e.g. CheckoutSuccess clears on mount, mid-hydration).
    const skipHydrationRef = useRef(false);

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
                if (stock <= 0) return;
                restored.push({
                    ...product,
                    quantity: Math.min(persisted[i].q, stock),
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

    useEffect(() => {
        if (!isHydrated || consent !== 'accepted') return;
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
    }, [cartItems, isHydrated, consent]);

    const addToCart = (product: LocalizedProduct, quantity: number, availableStock: number) => {
        setCartItems(prevItems => {
            const itemExists = prevItems.find(item => item.product_id === product.product_id);
            const stock = availableStock ?? product.bottle_count;
            if (itemExists) {
                return prevItems.map(item =>
                    item.product_id === product.product_id
                        ? { ...item, quantity: Math.min(item.quantity + quantity, stock), availableStock: stock }
                        : item
                );
            }
            return [...prevItems, { ...product, quantity: Math.min(quantity, stock), availableStock: stock }];
        });
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
                    const maxQuantity = availableStock !== undefined ? availableStock : item.availableStock;
                    return { ...item, quantity: Math.min(quantity, maxQuantity) };
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
