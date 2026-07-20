import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../context/CartContext';
import { LocalizedLink } from '../components/LocalizedLink';
import SEO from '../components/SEO';
import './Cart.css';

function CheckoutSuccess() {
    const { clearCart } = useContext(CartContext);
    const { t } = useTranslation();

    // The in-memory cart rarely survives the Stripe redirect, but clear it
    // anyway in case the browser restored the page from the bfcache.
    useEffect(() => {
        clearCart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="cart-page">
            <SEO title={t('seo.pageTitles.checkoutSuccess')} noindex />
            <header className="cart-header">
                <h1>{t('checkout.successTitle')}</h1>
            </header>
            <div className="empty-cart">
                <p>{t('checkout.successMessage')}</p>
                <p>{t('checkout.successEmailNote')}</p>
                <LocalizedLink to="/shop" className="button">{t('cart.continueShopping')}</LocalizedLink>
            </div>
        </div>
    );
}

export default CheckoutSuccess;
