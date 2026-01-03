import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { toFixed, toNumber } from '../utils/numberUtils';
import './Cart.css';

function Cart() {
    const { cartItems, removeFromCart, updateQuantity, clearCart } = useContext(CartContext);
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;

    const getTotalPrice = () => {
        return cartItems.reduce((total, item) => {
            const price = currentLanguage === 'ro' ? toNumber(item.price_ron) : toNumber(item.price);
            return total + price * item.quantity;
        }, 0).toFixed(2);
    };

    return (
        <div className="cart-page">
            <header className="cart-header">
                <h1>{t('cart.title')}</h1>
            </header>

            {cartItems.length === 0 ? (
                <div className="empty-cart">
                    <p>{t('cart.empty')}</p>
                    <Link to="/shop" className="button">{t('cart.continueShopping')}</Link>
                </div>
            ) : (
                <div className="cart-content">
                    <div className="cart-items-list">
                         {cartItems.map(item => {
                            const productName = currentLanguage === 'ro' && item.product_name_ro 
                                ? item.product_name_ro 
                                : item.product_name;
                            const price = currentLanguage === 'ro' ? item.price_ron : item.price;
                            const currency = currentLanguage === 'ro' ? t('common.ron') : t('common.euro');
                            
                            return (
                                <div key={item.product_id} className="cart-item">
                                    <div className="cart-item-details">
                                        <h3>{productName}</h3>
                                         <p className="cart-item-price">{toFixed(price)} {currency}</p>
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
                                         <p className="cart-item-subtotal">
                                              {t('cart.subtotal')}: {toFixed(toNumber(price) * item.quantity)} {currency}
                                         </p>
                                    </div>
                                    <button className="remove-item-btn" onClick={() => removeFromCart(item.product_id)}>
                                        &times;
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                     <aside className="cart-summary">
                        <h3>{t('cart.orderSummary')}</h3>
                        <div className="summary-total">
                            <span>{t('cart.total')}</span>
                            <span>{getTotalPrice()} {currentLanguage === 'ro' ? t('common.ron') : t('common.euro')}</span>
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
