import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import { openLockerMap, type ChosenLocker } from '../lib/lockerMap';
import type { DeliveryMethod } from '../types/generated/DeliveryMethod';
import type { LocalizedShippingRate } from '../types/generated/LocalizedShippingRate';
import { shippingPrice } from '../lib/shippingPrice';
import type { ShippingOptions } from '../types/generated/ShippingOptions';
import './CartDelivery.css';

interface CartDeliveryProps {
    options: ShippingOptions;
    productsTotal: number;
    method: DeliveryMethod;
    onMethodChange: (method: DeliveryMethod) => void;
    locker: ChosenLocker | null;
    onLockerChange: (locker: ChosenLocker) => void;
}

/// Delivery step of the cart: Sameday courier or an easybox locker picked on
/// Sameday's map. The home address itself is entered on Stripe's page.
function CartDelivery({ options, productsTotal, method, onMethodChange, locker, onLockerChange }: CartDeliveryProps) {
    const { t } = useTranslation();
    const language = useLanguage();
    const [mapError, setMapError] = useState(false);

    const chooseLocker = () => {
        if (!options.locker_map) return;
        setMapError(false);
        openLockerMap(options.locker_map, language, onLockerChange).catch(() => setMapError(true));
    };

    const priceLabel = (rate: LocalizedShippingRate) => {
        const price = shippingPrice(rate, productsTotal);
        return price === 0 ? t('cart.delivery.free') : `${price.toFixed(2)} ${rate.currency}${rate.is_converted ? '*' : ''}`;
    };

    return (
        <fieldset className="cart-delivery">
            <legend>{t('cart.delivery.title')}</legend>
            {options.rates.map(rate => (
                <label key={rate.delivery_method} className="cart-delivery-option">
                    <input
                        type="radio"
                        name="delivery"
                        value={rate.delivery_method}
                        checked={method === rate.delivery_method}
                        onChange={() => onMethodChange(rate.delivery_method)}
                    />
                    <span className="cart-delivery-name">{t(`cart.delivery.${rate.delivery_method}`)}</span>
                    <span className="cart-delivery-price">{priceLabel(rate)}</span>
                    {rate.free_from !== null && shippingPrice(rate, productsTotal) > 0 && (
                        <span className="cart-delivery-hint">
                            {t('cart.delivery.freeFrom', {
                                amount: `${rate.free_from.toFixed(2)} ${rate.currency}${rate.is_converted ? '*' : ''}`,
                            })}
                        </span>
                    )}
                </label>
            ))}
            {method === 'home' && <p className="cart-delivery-hint">{t('cart.delivery.homeHint')}</p>}
            {method === 'easybox' && (
                <div className="cart-delivery-locker">
                    {locker ? (
                        <p>
                            <strong>{locker.name}</strong>
                            <br />
                            {locker.address}, {locker.city}
                        </p>
                    ) : (
                        <p className="cart-delivery-hint">{t('cart.delivery.lockerHint')}</p>
                    )}
                    <button type="button" className="button-secondary" onClick={chooseLocker}>
                        {locker ? t('cart.delivery.changeLocker') : t('cart.delivery.chooseLocker')}
                    </button>
                    <p className="cart-delivery-hint">{t('cart.delivery.mapNotice')}</p>
                    {mapError && <p className="checkout-message" role="alert">{t('cart.delivery.mapError')}</p>}
                </div>
            )}
        </fieldset>
    );
}

export default CartDelivery;
