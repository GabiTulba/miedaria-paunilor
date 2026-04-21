import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { api } from '../lib/api';
import { toFixed, toNumber } from '../utils/numberUtils';
import './Cart.css';

function Cart() {
    const { cartItems, removeFromCart, updateQuantity, updateStock, clearCart } = useContext(CartContext);
    const { t } = useTranslation();
    const [stockWarnings, setStockWarnings] = useState<Record<string, string>>({});

    useEffect(() => {
        if (cartItems.length === 0) return;

        const controller = new AbortController();
        const validateStock = async () => {
            try {
                const results = await Promise.all(
                    cartItems.map(item =>
                        api.getProductById(item.product_id, controller.signal)
                            .then(data => ({
                                productId: item.product_id,
                                stock: data.product.bottle_count,
                                found: true,
                            }))
                            .catch(err => {
                                if (err instanceof DOMException && err.name === 'AbortError') throw err;
                                return { productId: item.product_id, stock: 0, found: false };
                            })
                    )
                );
                if (controller.signal.aborted) return;

                const warnings: Record<string, string> = {};
                for (const result of results) {
                    const cartItem = cartItems.find(i => i.product_id === result.productId);
                    if (!result.found) {
                        warnings[result.productId] = t('cart.productUnavailable');
                        updateStock(result.productId, 0);
                    } else if (cartItem && result.stock !== cartItem.availableStock) {
                        updateStock(result.productId, result.stock);
                        if (result.stock === 0) {
                            warnings[result.productId] = t('cart.outOfStock');
                        } else if (cartItem.quantity > result.stock) {
                            warnings[result.productId] = t('cart.quantityReduced', { max: result.stock });
                        }
                    }
                }
                setStockWarnings(warnings);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error('Failed to validate stock:', err);
            }
        };
        validateStock();
        return () => { controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getTotalPrice = () => {
        return cartItems.reduce((total, item) => {
            return total + toNumber(item.price) * item.quantity;
        }, 0).toFixed(2);
    };

    const cartCurrency = cartItems.length > 0 ? cartItems[0].currency : '';

    return (
        <div className="cart-page">
            <header className="cart-header">
                <h1>{t('cart.title')}</h1>
            </header>

            <div className="cart-warning">
                <h3>{t('cart.workInProgress')}</h3>
                <p>{t('cart.workInProgressMessage')}</p>
            </div>

            {cartItems.length === 0 ? (
                <div className="empty-cart">
                    <p>{t('cart.empty')}</p>
                    <Link to="/shop" className="button">{t('cart.continueShopping')}</Link>
                </div>
            ) : (
                <div className="cart-content">
                    <div className="cart-items-list">
                         {cartItems.map(item => (
                                <div key={item.product_id} className="cart-item">
                                    <div className="cart-item-details">
                                        <h3>{item.product_name}</h3>
                                         <p className="cart-item-price">{toFixed(item.price)} {item.currency}</p>
                                         <div className="quantity-selector-cart">
                                             <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>-</button>
                                             <span>{item.quantity}</span>
                                             <button
                                                 onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.availableStock)}
                                                 disabled={item.quantity >= item.availableStock}
                                             >+</button>
                                         </div>
                                         {item.quantity >= item.availableStock && item.availableStock > 0 && (
                                             <div className="cart-max-quantity-message">
                                                 {t('product.maxQuantityReached', { count: item.availableStock })}
                                             </div>
                                         )}
                                         {stockWarnings[item.product_id] && (
                                             <div className="cart-stock-warning">
                                                 {stockWarnings[item.product_id]}
                                             </div>
                                         )}
                                         <p className="cart-item-subtotal">
                                              {t('cart.subtotal')}: {toFixed(toNumber(item.price) * item.quantity)} {item.currency}
                                         </p>
                                    </div>
                                    <button className="remove-item-btn" onClick={() => removeFromCart(item.product_id)}>
                                        &times;
                                    </button>
                                </div>
                            ))}
                    </div>

                     <aside className="cart-summary">
                        <h3>{t('cart.orderSummary')}</h3>
                        <div className="summary-total">
                            <span>{t('cart.total')}</span>
                            <span>{getTotalPrice()} {cartCurrency}</span>
                        </div>
                        <button className="button checkout-btn">{t('cart.proceedToCheckout')}</button>
                        <button className="button-secondary clear-cart-btn" onClick={clearCart}>
                            {t('cart.clearCart')}
                        </button>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default Cart;
