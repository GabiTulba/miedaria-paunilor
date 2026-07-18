import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, getImageUrl, getImageSrcSet } from '../lib/api';
import type { ApiError } from '../types/api';
import { getEnumLabel } from '../enums';
import { useFormattedDate } from '../hooks/useFormattedDate';
import { useFetch } from '../hooks/useFetch';
import ErrorDisplay from '../components/ErrorDisplay';
import Breadcrumb from '../components/Breadcrumb';
import SEO from '../components/SEO';
import { LocalizedLink } from '../components/LocalizedLink';
import { useLanguage } from '../hooks/useLanguage';
import { clamp } from '../lib/text';
import { Skeleton } from '../components/Skeleton';

import './LotDetails.css';

// Reached via the QR code on the bottle's back label: shows the batch's
// ingredients, product details, and EU nutrition declaration.
function LotDetails() {
    const { lotNumber } = useParams<{ lotNumber: string }>();
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const { t, i18n } = useTranslation();
    const lang = useLanguage();
    const formatDate = useFormattedDate();

    const { data: lot, loading: isLoading, error, refetch } = useFetch(
        signal => lotNumber ? api.getLot(lotNumber, signal) : Promise.resolve(null as never),
        [lotNumber, i18n.language],
    );

    if (isLoading) {
        return (
            <div className="lot-details-page">
                <div className="lot-details-content">
                    <div className="lot-image-column">
                        <Skeleton w="100%" style={{ aspectRatio: '1/1', borderRadius: 'var(--radius-md)' }} />
                    </div>
                    <div className="lot-info-section">
                        <Skeleton h="2em" w="80%" style={{ marginBottom: '0.75rem' }} />
                        <Skeleton h="1.5em" w="40%" style={{ marginBottom: '1.5rem' }} />
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} h="1em" w="60%" style={{ marginBottom: '0.5rem' }} />
                        ))}
                        <Skeleton h="12em" style={{ marginTop: '1.5rem' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !lot) {
        const isNotFound = (error as ApiError | null)?.response?.status === 404;
        return (
            <div className="lot-details-page">
                <ErrorDisplay
                    error={isNotFound ? t('lot.notFoundMessage') : t('errors.serverError')}
                    onRetry={!isNotFound && error ? refetch : undefined}
                    retryLabel={t('common.retry')}
                />
            </div>
        );
    }

    const { product, image, nutrition } = lot;
    const formatNumber = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format;
    const lotLabel = t('lot.title', { number: lot.lot_number });

    const gramRows: { labelKey: string; value: number; indented?: boolean }[] = [
        { labelKey: 'fat', value: nutrition.fat },
        { labelKey: 'saturates', value: nutrition.saturates, indented: true },
        { labelKey: 'carbohydrates', value: nutrition.carbohydrates },
        { labelKey: 'sugars', value: nutrition.sugars, indented: true },
        { labelKey: 'protein', value: nutrition.protein },
        { labelKey: 'salt', value: nutrition.salt },
    ];

    return (
        <div className="lot-details-page">
            <SEO
                title={`${lotLabel} — ${product.product_name}`}
                description={clamp(t('lot.seoDescription', { number: lot.lot_number, productName: product.product_name }), 160)}
                noindex
            />
            <Breadcrumb items={[
                { label: t('navigation.home'), to: '/' },
                { label: lotLabel },
            ]} />
            <div className="lot-details-content">
                <div className="lot-image-column">
                    {image && !imgError ? (
                        <div className={`lot-image-wrapper${imgLoaded ? ' is-loaded' : ''}`}>
                            <img
                                src={getImageUrl(image.id, 1024)}
                                srcSet={getImageSrcSet(image.id)}
                                sizes="(min-width: 992px) 420px, 100vw"
                                alt={product.product_name}
                                className="lot-product-image"
                                width={1024}
                                height={1024}
                                loading="eager"
                                fetchPriority="high"
                                decoding="async"
                                onLoad={() => setImgLoaded(true)}
                                onError={() => setImgError(true)}
                            />
                            {!imgLoaded && <Skeleton className="lot-product-image-skeleton" />}
                        </div>
                    ) : null}
                </div>
                <div className="lot-info-section">
                    <h1>{product.product_name}</h1>
                    <p className="lot-subtitle">{lotLabel} · {t('lot.subtitle')}</p>

                    <div className="lot-basic-info">
                        <div className="lot-info-item">
                            <span className="lot-info-label">{t('lot.lotNumber')}:</span>
                            <span className="lot-info-value">{lot.lot_number}</span>
                        </div>
                        <div className="lot-info-item">
                            <span className="lot-info-label">{t('lot.bottlingDate')}:</span>
                            <span className="lot-info-value">{formatDate(lot.bottling_date)}</span>
                        </div>
                        <div className="lot-info-item">
                            <span className="lot-info-label">{t('lot.abv')}:</span>
                            <span className="lot-info-value">{lot.abv}% vol.</span>
                        </div>
                        <div className="lot-info-item">
                            <span className="lot-info-label">{t('product.bottleSize')}:</span>
                            <span className="lot-info-value">{product.bottle_size}{t('common.milliliters')}</span>
                        </div>
                    </div>

                    <section className="lot-section">
                        <h2>{t('lot.ingredients')}</h2>
                        <p className="lot-ingredients">{product.ingredients}</p>
                    </section>

                    <section className="lot-section">
                        <h2>{t('lot.nutrition')}</h2>
                        <table className="nutrition-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('lot.nutrition')}</th>
                                    <th scope="col">{t('lot.per100ml')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{t('lot.energy')}</td>
                                    <td>{formatNumber(nutrition.energy_kj)} kJ / {formatNumber(nutrition.energy_kcal)} kcal</td>
                                </tr>
                                {gramRows.map(({ labelKey, value, indented }) => (
                                    <tr key={labelKey}>
                                        <td className={indented ? 'nutrition-indent' : undefined}>{t(`lot.${labelKey}`)}</td>
                                        <td>{formatNumber(value)} g</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="lot-section">
                        <h2>{t('lot.productDetails')}</h2>
                        <div className="lot-details-grid">
                            {([
                                ['productType', getEnumLabel(product.product_type, 'mead_type', t)],
                                ['sweetness', getEnumLabel(product.sweetness, 'sweetness', t)],
                                ['turbidity', getEnumLabel(product.turbidity, 'turbidity', t)],
                                ['effervescence', getEnumLabel(product.effervescence, 'effervescence', t)],
                                ['acidity', getEnumLabel(product.acidity, 'acidity', t)],
                                ['tannins', getEnumLabel(product.tannins, 'tannins', t)],
                                ['body', getEnumLabel(product.body, 'body', t)],
                            ] as const).map(([key, label]) => (
                                <div className="lot-detail-item" key={key}>
                                    <span className="lot-detail-label">{t(`product.${key}`)}:</span>
                                    <span className="lot-detail-value">{label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {lot.product_available ? (
                        <LocalizedLink to={`/shop/${product.product_id}`} className="button lot-shop-link">
                            {t('lot.viewProduct')}
                        </LocalizedLink>
                    ) : (
                        <p className="lot-unavailable-note">{t('lot.productUnavailable')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LotDetails;
