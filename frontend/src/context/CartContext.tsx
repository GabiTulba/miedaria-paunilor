import { createContext, useState, ReactNode } from 'react';
import { LocalizedProduct } from '../types';

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

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

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
        setCartItems([]);
    };

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, updateStock, updateProduct, clearCart, itemCount }}>
            {children}
        </CartContext.Provider>
    );
}
