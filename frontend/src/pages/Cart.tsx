import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../context/CartContext';
import { api } from '../lib/api';
import { toFixed, toNumber } from '../utils/numberUtils';
import { LocalizedLink } from '../components/LocalizedLink';
import SEO from '../components/SEO';
import './Cart.css';

const DEFAULT_CURRENCY = 'EUR';

function Cart() {
    const { cartItems, removeFromCart, updateQuantity, updateStock, updateProduct, clearCart } = useContext(CartContext);
    const { t, i18n } = useTranslation();
    const [stockWarnings, setStockWarnings] = useState<Record<string, string>>({});
    const [showWarning, setShowWarning] = useState(true);
    const [checkoutMessage, setCheckoutMessage] = useState(false);
    const [pulsingButtons, setPulsingButtons] = useState<Record<string, true>>({});

    const triggerPulse = (key: string) => {
        setPulsingButtons(prev => ({ ...prev, [key]: true }));
        window.setTimeout(() => {
            setPulsingButtons(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }, 400);
    };

    useEffect(() => {
        if (cartItems.length === 0) return;

        const controller = new AbortController();
        const validateAndSync = async () => {
            const settled = await Promise.allSettled(
                cartItems.map(item => api.getProductById(item.product_id, controller.signal))
            );
            if (controller.signal.aborted) return;

            const warnings: Record<string, string> = {};
            for (let i = 0; i < cartItems.length; i++) {
                const cartItem = cartItems[i];
                const result = settled[i];
                if (result.status === 'rejected') {
                    const reason = result.reason;
                    if (reason instanceof DOMException && reason.name === 'AbortError') return;
                    warnings[cartItem.product_id] = t('cart.productUnavailable');
                    updateStock(cartItem.product_id, 0);
                    continue;
                }
                const data = result.value;
                updateProduct(cartItem.product_id, {
                    product_name: data.product.product_name,
                    price: data.product.price,
                    currency: data.product.currency,
                });
                const stock = data.product.bottle_count;
                if (stock !== cartItem.availableStock) {
                    updateStock(cartItem.product_id, stock);
                    if (stock === 0) {
                        warnings[cartItem.product_id] = t('cart.outOfStock');
                    } else if (cartItem.quantity > stock) {
                        warnings[cartItem.product_id] = t('cart.quantityReduced', { max: stock });
                    }
                }
            }
            setStockWarnings(warnings);
        };
        validateAndSync();
        return () => { controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language]);

    const handleCheckout = () => {
        setCheckoutMessage(true);
        setTimeout(() => setCheckoutMessage(false), 5000);
    };

    // TODO: when checkout is implemented, totals MUST be recomputed server-side from
    // the canonical price list before charging. Treat this client-side total as display-only.
    const getTotalCents = () =>
        cartItems.reduce((total, item) => total + Math.round(toNumber(item.price) * 100) * item.quantity, 0);
    const getTotalPrice = () => (getTotalCents() / 100).toFixed(2);

    const cartCurrency = cartItems.length > 0 ? cartItems[0].currency : DEFAULT_CURRENCY;

    return (
        <div className="cart-page">
            <SEO title={t('seo.pageTitles.cart')} description={t('seo.pageDescriptions.cart')} noindex />
            <header className="cart-header">
                <h1>{t('cart.title')}</h1>
            </header>

            {showWarning && (
                <div className="cart-warning">
                    <button className="cart-warning-dismiss" onClick={() => setShowWarning(false)} aria-label={t('common.close')}>&times;</button>
                    <h3>{t('cart.workInProgress')}</h3>
                    <p>{t('cart.workInProgressMessage')}</p>
                </div>
            )}

            {cartItems.length === 0 ? (
                <div className="empty-cart">
                    <div className="empty-state-icon cart-empty-icon"></div>
                    <p>{t('cart.empty')}</p>
                    <LocalizedLink to="/shop" className="button">{t('cart.continueShopping')}</LocalizedLink>
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
                                             <button
                                                 className={pulsingButtons[`${item.product_id}-dec`] ? 'success-pulse' : undefined}
                                                 onClick={() => {
                                                     if (item.quantity <= 1) return;
                                                     updateQuantity(item.product_id, item.quantity - 1);
                                                     triggerPulse(`${item.product_id}-dec`);
                                                 }}
                                                 aria-label={t('product.decreaseQuantity')}
                                                 disabled={item.quantity <= 1}
                                             >-</button>
                                             <input
                                                 type="number"
                                                 className="quantity-input"
                                                 value={item.quantity}
                                                 min={1}
                                                 max={Math.min(99, item.availableStock)}
                                                 step={1}
                                                 aria-label={t('product.quantity')}
                                                 onChange={(e) => {
                                                     const raw = e.target.value;
                                                     if (raw === '') return;
                                                     const val = parseInt(raw, 10);
                                                     if (!Number.isInteger(val) || String(val) !== raw.replace(/^0+(?=\d)/, '')) return;
                                                     const clamped = Math.max(1, Math.min(val, Math.min(99, item.availableStock)));
                                                     updateQuantity(item.product_id, clamped, item.availableStock);
                                                 }}
                                             />
                                             <button
                                                 className={pulsingButtons[`${item.product_id}-inc`] ? 'success-pulse' : undefined}
                                                 onClick={() => {
                                                     updateQuantity(item.product_id, item.quantity + 1, item.availableStock);
                                                     triggerPulse(`${item.product_id}-inc`);
                                                 }}
                                                 aria-label={t('product.increaseQuantity')}
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
                                              {t('cart.subtotal')}: {(Math.round(toNumber(item.price) * 100) * item.quantity / 100).toFixed(2)} {item.currency}
                                         </p>
                                    </div>
                                    <button className="remove-item-btn" onClick={() => removeFromCart(item.product_id)} aria-label={t('cart.remove')}>
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
                        <button className="button checkout-btn" onClick={handleCheckout}>{t('cart.proceedToCheckout')}</button>
                        {checkoutMessage && (
                            <p className="checkout-message">{t('cart.checkoutNotReady')}</p>
                        )}
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
