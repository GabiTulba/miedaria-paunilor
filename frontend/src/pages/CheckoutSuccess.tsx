import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../context/CartContext';
import { useAccount } from '../context/AccountContext';
import { forgetPendingCheckout } from '../lib/pendingCheckout';
import { LocalizedLink } from '../components/LocalizedLink';
import SEO from '../components/SEO';
import './Cart.css';

function CheckoutSuccess() {
    const { clearCart } = useContext(CartContext);
    const { account } = useAccount();
    const { t } = useTranslation();

    // The in-memory cart rarely survives the Stripe redirect, but clear it
    // anyway in case the browser restored the page from the bfcache.
    useEffect(() => {
        forgetPendingCheckout();
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
                <p>
                    {account ? (
                        <LocalizedLink to="/account">{t('checkout.viewInAccount')}</LocalizedLink>
                    ) : (
                        <>
                            {t('checkout.createAccountHint')}{' '}
                            <LocalizedLink to="/account/register">{t('checkout.createAccount')}</LocalizedLink>
                        </>
                    )}
                </p>
                <LocalizedLink to="/shop" className="button">{t('cart.continueShopping')}</LocalizedLink>
            </div>
        </div>
    );
}

export default CheckoutSuccess;
