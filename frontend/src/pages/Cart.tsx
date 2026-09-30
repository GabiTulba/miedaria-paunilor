import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../context/CartContext';
import { useAccount } from '../context/AccountContext';
import { rememberPendingCheckout } from '../lib/pendingCheckout';
import { api } from '../lib/api';
import { toFixed, toNumber } from '../utils/numberUtils';
import { LocalizedLink } from '../components/LocalizedLink';
import { usePulse } from '../hooks/usePulse';
import SEO from '../components/SEO';
import EurConversionNote from '../components/EurConversionNote';
import CartDelivery from '../components/CartDelivery';
import { shippingPrice } from '../lib/shippingPrice';
import { rememberedLocker, type ChosenLocker } from '../lib/lockerMap';
import type { DeliveryMethod } from '../types/generated/DeliveryMethod';
import type { ShippingOptions } from '../types/generated/ShippingOptions';
import { MAX_ORDER_BOTTLES } from '../utils/stockAvailability';
import type { ApiError } from '../types/api';
import './Cart.css';

const DEFAULT_CURRENCY = 'EUR';

function Cart() {
    const { account } = useAccount();
    const { cartItems, removeFromCart, updateQuantity, updateStock, updateProduct, clearCart, itemCount } = useContext(CartContext);
    const { t, i18n } = useTranslation();
    const [stockWarnings, setStockWarnings] = useState<Record<string, string>>({});
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isCheckoutEnabled, setIsCheckoutEnabled] = useState(true);
    const [shippingOptions, setShippingOptions] = useState<ShippingOptions | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('home');
    const [locker, setLocker] = useState<ChosenLocker | null>(rememberedLocker);
    const [adultConfirmed, setAdultConfirmed] = useState(false);
    const [shippingLoadFailed, setShippingLoadFailed] = useState(false);
    const { isPulsing, pulse } = usePulse();

    useEffect(() => {
        const controller = new AbortController();
        api.getCheckoutStatus(controller.signal)
            .then(status => setIsCheckoutEnabled(status.enabled))
            .catch(() => {
                // Keep the button usable; the server guard has the final say.
            });
        return () => controller.abort();
    }, []);

    // Prices follow the site's currency, so they are fetched per language.
    useEffect(() => {
        const controller = new AbortController();
        setShippingLoadFailed(false);
        api.getShippingOptions(controller.signal)
            .then(options => {
                setShippingOptions(options);
                const offered = options.rates.map(r => r.delivery_method);
                setDeliveryMethod(current => (offered.includes(current) ? current : offered[0] ?? 'home'));
            })
            .catch(err => {
                if (!controller.signal.aborted) {
                    console.error('Failed to load delivery options:', err);
                    setShippingOptions(null);
                    setShippingLoadFailed(true);
                }
            });
        return () => controller.abort();
    }, [i18n.language]);

    // Coming back from Stripe with the browser's Back button can restore this
    // page from the back/forward cache with the button still "redirecting".
    useEffect(() => {
        const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) setIsCheckingOut(false);
        };
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, []);

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
                    is_converted: data.product.is_converted,
                    rate_date: data.product.rate_date,
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

    const handleCheckout = async () => {
        setCheckoutError(null);
        setIsCheckingOut(true);
        try {
            const { url, order_id } = await api.createCheckoutSession({
                items: cartItems.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
                delivery: deliveryMethod === 'easybox' && locker
                    ? { method: 'easybox', locker_id: locker.lockerId }
                    : { method: 'home' },
                adult_confirmed: adultConfirmed,
            });
            // If the customer comes back without paying, the cart releases
            // this order's reserved stock (see CartContext).
            rememberPendingCheckout(order_id);
            window.location.assign(url);
        } catch (err) {
            console.error('Failed to start checkout:', err);
            const status = (err as Partial<ApiError>).response?.status;
            // 400 = the delivery can't be used (locker gone, parcel too heavy
            //       for an easybox, method switched off);
            // 409 = a product went out of stock between page load and checkout;
            // 429 = too many checkouts started from this network recently;
            // 503 = an admin disabled checkout after this page loaded.
            if (status === 503) {
                setIsCheckoutEnabled(false);
                setCheckoutError(null);
            } else if (status === 400) {
                setCheckoutError(t('cart.delivery.unavailable'));
            } else if (status === 409) {
                setCheckoutError(t('cart.checkoutOutOfStock'));
            } else if (status === 429) {
                setCheckoutError(t('cart.checkoutTooManyAttempts'));
            } else {
                setCheckoutError(t('cart.checkoutError'));
            }
            setIsCheckingOut(false);
        }
    };

    // Display only: checkout recomputes every amount server-side in RON.
    const productsCents = cartItems.reduce(
        (total, item) => total + Math.round(toNumber(item.price) * 100) * item.quantity, 0);
    const selectedRate = shippingOptions?.rates.find(r => r.delivery_method === deliveryMethod);
    const shippingCents = selectedRate ? Math.round(shippingPrice(selectedRate, productsCents / 100) * 100) : 0;
    const needsLocker = deliveryMethod === 'easybox' && !locker;

    const cartCurrency = cartItems.length > 0 ? cartItems[0].currency : DEFAULT_CURRENCY;
    const converted = cartItems.some(i => i.is_converted) ? '*' : '';

    return (
        <div className="cart-page">
            <SEO title={t('seo.pageTitles.cart')} description={t('seo.pageDescriptions.cart')} noindex />
            <header className="cart-header">
                <h1>{t('cart.title')}</h1>
            </header>

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
                                         <p className="cart-item-price">{toFixed(item.price)} {item.currency}{item.is_converted ? '*' : ''}</p>
                                         <div className="quantity-selector-cart">
                                             <button
                                                 className={isPulsing(`${item.product_id}-dec`) ? 'success-pulse' : undefined}
                                                 onClick={() => {
                                                     if (item.quantity <= 1) return;
                                                     updateQuantity(item.product_id, item.quantity - 1);
                                                     pulse(`${item.product_id}-dec`);
                                                 }}
                                                 aria-label={t('product.decreaseQuantity')}
                                                 disabled={item.quantity <= 1}
                                             >-</button>
                                             <input
                                                 type="number"
                                                 className="quantity-input"
                                                 value={item.quantity}
                                                 min={1}
                                                 max={Math.min(item.availableStock, item.quantity + MAX_ORDER_BOTTLES - itemCount)}
                                                 step={1}
                                                 aria-label={t('product.quantity')}
                                                 onChange={(e) => {
                                                     const raw = e.target.value;
                                                     if (raw === '') return;
                                                     const val = parseInt(raw, 10);
                                                     if (!Number.isInteger(val) || String(val) !== raw.replace(/^0+(?=\d)/, '')) return;
                                                     updateQuantity(item.product_id, Math.max(1, val), item.availableStock);
                                                 }}
                                             />
                                             <button
                                                 className={isPulsing(`${item.product_id}-inc`) ? 'success-pulse' : undefined}
                                                 onClick={() => {
                                                     updateQuantity(item.product_id, item.quantity + 1, item.availableStock);
                                                     pulse(`${item.product_id}-inc`);
                                                 }}
                                                 aria-label={t('product.increaseQuantity')}
                                                 disabled={item.quantity >= item.availableStock || itemCount >= MAX_ORDER_BOTTLES}
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
                                              {t('cart.subtotal')}: {(Math.round(toNumber(item.price) * 100) * item.quantity / 100).toFixed(2)} {item.currency}{item.is_converted ? '*' : ''}
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
                        {shippingOptions && shippingOptions.rates.length > 0 && (
                            <CartDelivery
                                options={shippingOptions}
                                productsTotal={productsCents / 100}
                                method={deliveryMethod}
                                onMethodChange={setDeliveryMethod}
                                locker={locker}
                                onLockerChange={setLocker}
                            />
                        )}
                        <div className="summary-line">
                            <span>{t('cart.products')}</span>
                            <span>{(productsCents / 100).toFixed(2)} {cartCurrency}{converted}</span>
                        </div>
                        {selectedRate && (
                            <div className="summary-line">
                                <span>{t('cart.delivery.shipping')}</span>
                                <span>
                                    {shippingCents === 0
                                        ? t('cart.delivery.free')
                                        : `${(shippingCents / 100).toFixed(2)} ${cartCurrency}${converted}`}
                                </span>
                            </div>
                        )}
                        <div className="summary-total">
                            <span>{t('cart.total')}</span>
                            <span>{((productsCents + shippingCents) / 100).toFixed(2)} {cartCurrency}{converted}</span>
                        </div>
                        <EurConversionNote products={cartItems} />
                        {itemCount >= MAX_ORDER_BOTTLES && (
                            <p className="checkout-message">{t('cart.orderLimitReached', { max: MAX_ORDER_BOTTLES })}</p>
                        )}
                        <label className="cart-age-confirm">
                            <input
                                type="checkbox"
                                checked={adultConfirmed}
                                onChange={e => setAdultConfirmed(e.target.checked)}
                            />
                            <span>{t('cart.adultConfirm')}</span>
                        </label>
                        {shippingLoadFailed && <p className="checkout-message" role="alert">{t('cart.delivery.loadError')}</p>}
                        {needsLocker && <p className="checkout-message">{t('cart.delivery.lockerRequired')}</p>}
                        <button
                            className="button checkout-btn"
                            onClick={handleCheckout}
                            disabled={isCheckingOut || !isCheckoutEnabled || !adultConfirmed || needsLocker || !shippingOptions}
                        >
                            {isCheckingOut ? t('cart.redirectingToPayment') : t('cart.proceedToCheckout')}
                        </button>
                        {!isCheckoutEnabled && (
                            <p className="checkout-message" role="alert">{t('cart.checkoutDisabled')}</p>
                        )}
                        {checkoutError && (
                            <p className="checkout-message" role="alert">{checkoutError}</p>
                        )}
                        {!account && (
                            <p className="checkout-account-hint">
                                <LocalizedLink to="/account/login?next=/cart">{t('cart.accountLogin')}</LocalizedLink>
                                {' '}{t('cart.accountOptional')}
                            </p>
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
