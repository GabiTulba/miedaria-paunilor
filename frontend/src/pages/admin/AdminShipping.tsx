import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorDisplay from '../../components/ErrorDisplay';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import type { ShippingRate } from '../../types/generated/ShippingRate';
import './Admin.css';

interface RateForm {
    price: string;
    freeFrom: string;
    enabled: boolean;
}

const toForm = (rate: ShippingRate): RateForm => ({
    price: (rate.price_cents / 100).toFixed(2),
    freeFrom: rate.free_from_cents === null ? '' : (rate.free_from_cents / 100).toFixed(2),
    enabled: rate.enabled,
});

const toCents = (value: string) => Math.round(Number(value) * 100);

/// Flat shipping prices per delivery method, in RON, and the order value
/// from which each is free.
function AdminShipping() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { data, loading, error, refetch } = useFetch(signal => api.getShippingRates(signal), []);
    const [forms, setForms] = useState<Record<string, RateForm>>({});
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        if (data) setForms(Object.fromEntries(data.map(rate => [rate.delivery_method, toForm(rate)])));
    }, [data]);

    const update = (method: string, patch: Partial<RateForm>) =>
        setForms(prev => ({ ...prev, [method]: { ...prev[method], ...patch } }));

    const save = async (rate: ShippingRate) => {
        const form = forms[rate.delivery_method];
        setSaving(rate.delivery_method);
        try {
            const updated = await api.updateShippingRate({
                delivery_method: rate.delivery_method,
                price_cents: toCents(form.price),
                free_from_cents: form.freeFrom.trim() === '' ? null : toCents(form.freeFrom),
                enabled: form.enabled,
            });
            setForms(Object.fromEntries(updated.map(r => [r.delivery_method, toForm(r)])));
            showToast(t('admin.shipping.saved'), 'success');
        } catch (err) {
            console.error('Failed to save shipping rate:', err);
            showToast(t('admin.shipping.saveError'), 'error');
        } finally {
            setSaving(null);
        }
    };

    if (error) {
        return (
            <div className="admin-content">
                <ErrorDisplay error={t('admin.shipping.loadError')} onRetry={refetch} retryLabel={t('admin.products.retry')} />
            </div>
        );
    }

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-content">
                    <h1>{t('admin.shipping.title')}</h1>
                    <p>{t('admin.shipping.subtitle')}</p>
                </div>
            </div>
            {loading || !data ? (
                <div className="loading-state">
                    <div className="loading-icon"></div>
                    <p>{t('common.loading')}</p>
                </div>
            ) : (
                <div className="shipping-rates-form">
                    {data.map(rate => {
                        const form = forms[rate.delivery_method];
                        if (!form) return null;
                        const price = Number(form.price);
                        const freeFrom = form.freeFrom.trim() === '' ? null : Number(form.freeFrom);
                        const valid = form.price !== '' && price >= 0 && price <= 1000
                            && (freeFrom === null || (freeFrom > 0 && freeFrom <= 100000));
                        return (
                            <form
                                key={rate.delivery_method}
                                className="shipping-rate-card"
                                onSubmit={e => { e.preventDefault(); save(rate); }}
                            >
                                <h3>{t(`cart.delivery.${rate.delivery_method}`)}</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`price-${rate.delivery_method}`}>{t('admin.shipping.price')}</label>
                                        <input
                                            id={`price-${rate.delivery_method}`}
                                            className="form-input"
                                            type="number"
                                            min="0"
                                            max="1000"
                                            step="0.01"
                                            required
                                            value={form.price}
                                            onChange={e => update(rate.delivery_method, { price: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`free-${rate.delivery_method}`}>{t('admin.shipping.freeFrom')}</label>
                                        <input
                                            id={`free-${rate.delivery_method}`}
                                            className="form-input"
                                            type="number"
                                            min="0.01"
                                            max="100000"
                                            step="0.01"
                                            value={form.freeFrom}
                                            onChange={e => update(rate.delivery_method, { freeFrom: e.target.value })}
                                        />
                                        <p className="help-text">{t('admin.shipping.freeFromHelp')}</p>
                                    </div>
                                </div>
                                <label className="awb-form-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={form.enabled}
                                        onChange={e => update(rate.delivery_method, { enabled: e.target.checked })}
                                    />{' '}
                                    {t('admin.shipping.enabled')}
                                </label>
                                {rate.delivery_method === 'easybox' && (
                                    <p className="help-text">{t('admin.shipping.easyboxHelp')}</p>
                                )}
                                <button className="button" type="submit" disabled={!valid || saving === rate.delivery_method}>
                                    {saving === rate.delivery_method ? t('common.loading') : t('admin.shipping.save')}
                                </button>
                            </form>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default AdminShipping;
