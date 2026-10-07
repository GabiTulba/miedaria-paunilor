import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import ErrorDisplay from '../../components/ErrorDisplay';
import SelectInput from '../../components/forms/SelectInput';
import FormField from '../../components/forms/FormField';
import TextInput from '../../components/forms/TextInput';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import { saveBlob } from '../../lib/download';
import {
    backContent, emptyLabelForm, formField, frontContent, withProduct,
    type LabelForm, type LabelFormField, type LabelTextField,
} from '../../lib/labelForm';
import { MEDAL_FILE_TYPES, medalPng } from '../../lib/medalImage';
import type { ApiError } from '../../types/api';
import type { ProductWithImage } from '../../types/models';
import type { LabelError } from '../../types/generated/LabelError';
import type { LabelPreview } from '../../types/generated/LabelPreview';
import type { LabelPreviewRequest } from '../../types/generated/LabelPreviewRequest';
import type { LabelPreviewSide } from '../../types/generated/LabelPreviewSide';
import type { LabelSize } from '../../types/generated/LabelSize';
import './Admin.css';
import './AdminLabels.css';

/// Pause after the last edit before the preview is redrawn.
const PREVIEW_DELAY_MS = 800;
const PRODUCTS_PER_PAGE = 100;

type Side = 'front' | 'back';
type FieldErrors = Partial<Record<LabelFormField, string>>;

interface PreviewState {
    result: LabelPreview | null;
    loading: boolean;
    error: string | null;
}

/// Every product on sale, for the "fill from product" picker.
async function listedProducts(signal: AbortSignal): Promise<ProductWithImage[]> {
    const products: ProductWithImage[] = [];
    for (let page = 1; ; page++) {
        const response = await api.getAdminProducts({ page, per_page: PRODUCTS_PER_PAGE }, signal);
        products.push(...response.items);
        if (page >= response.total_pages) return products;
    }
}

/// The label format matching a bottle volume, if any.
const sizeForBottle = (sizes: LabelSize[], bottleMl: number) =>
    sizes.find(size => size.volume_cl * 10 === bottleMl)?.name;

function requestFailure(err: unknown, t: TFunction): string {
    return (err as ApiError).response?.status === 503
        ? t('admin.labels.unavailable')
        : t('admin.labels.requestError');
}

function labelErrorMessage(error: LabelError, t: TFunction): string {
    switch (error.code) {
        case 'invalid_field': {
            const field = formField(error.field);
            const problem = t(`admin.labels.problems.${error.problem}`, {
                defaultValue: error.problem,
                detail: error.detail ?? '',
            });
            return field ? `${t(`admin.labels.fields.${field}`)}: ${problem}` : problem;
        }
        case 'does_not_fit':
            return t('admin.labels.doesNotFit', { size: error.size, detail: error.detail });
        case 'illegible':
            return t('admin.labels.illegible', {
                size: error.size,
                measures: error.detail
                    .map(m => `${m.measure} ${m.printed_mm} mm < ${m.minimum_mm} mm`)
                    .join('; '),
            });
    }
}

/// Inline errors for the fields the renderer refused.
function fieldErrors(errors: LabelError[], t: TFunction): FieldErrors {
    const result: FieldErrors = {};
    for (const error of errors) {
        if (error.code !== 'invalid_field') continue;
        const field = formField(error.field);
        if (field && !result[field]) {
            result[field] = t(`admin.labels.problems.${error.problem}`, {
                defaultValue: error.problem,
                detail: error.detail ?? '',
            });
        }
    }
    return result;
}

const sideError = (side: LabelPreviewSide | null): LabelError | null =>
    side && 'error' in side ? side.error : null;

/// An SVG document shown through a blob URL in an <img>, where its markup
/// can't run scripts.
function SvgImage({ svg, alt }: { svg: string; alt: string }) {
    const [url, setUrl] = useState<string>();
    useEffect(() => {
        const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [svg]);
    return url ? <img src={url} alt={alt} /> : null;
}

function PreviewPanel({ side, result, loading }: { side: Side; result: LabelPreviewSide | null; loading: boolean }) {
    const { t } = useTranslation();
    return (
        <section className={`label-preview${loading ? ' is-loading' : ''}`} aria-busy={loading}>
            <h3>{t(`admin.labels.${side}`)}</h3>
            {!result ? (
                <p className="label-preview-note">{loading ? t('common.loading') : t('admin.labels.noPreview')}</p>
            ) : 'error' in result ? (
                <p className="label-preview-error" role="alert">{labelErrorMessage(result.error, t)}</p>
            ) : (
                <>
                    <SvgImage svg={result.svg} alt={t(`admin.labels.${side}`)} />
                    {result.dropped.length > 0 && (
                        <p className="label-preview-note">
                            {t('admin.labels.dropped', {
                                items: result.dropped
                                    .map(item => t(`admin.labels.extras.${item}`, { defaultValue: item }))
                                    .join(', '),
                            })}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}

/// Front and back bottle labels from the artwork generator: filled in by
/// hand or from a product (`?product=<id>`), previewed as they are edited,
/// and downloaded as a ZIP of print-ready files.
function AdminLabels() {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const productId = searchParams.get('product') ?? '';
    const sizes = useFetch(signal => api.getLabelSizes(signal), []);
    const products = useFetch(listedProducts, []);
    const [form, setForm] = useState<LabelForm>(emptyLabelForm);
    const [size, setSize] = useState('');
    const [bottleMl, setBottleMl] = useState<number | null>(null);
    const [allSizes, setAllSizes] = useState(false);
    const [preview, setPreview] = useState<PreviewState>({ result: null, loading: false, error: null });
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<LabelError | string | null>(null);
    const [medalError, setMedalError] = useState<string | null>(null);

    useEffect(() => {
        if (!productId) return;
        const controller = new AbortController();
        api.getProductByIdAdmin(productId, controller.signal)
            .then(detail => {
                setForm(current => withProduct(current, detail.product));
                setBottleMl(detail.product.bottle_size);
            })
            .catch(err => {
                if (controller.signal.aborted) return;
                console.error('Failed to load the product for its label:', err);
                showToast(t('admin.labels.productLoadError'), 'error');
            });
        return () => controller.abort();
    }, [productId, showToast, t]);

    // The product's bottle format once both are known, else the first format.
    useEffect(() => {
        if (!sizes.data?.length) return;
        const matching = bottleMl === null ? undefined : sizeForBottle(sizes.data, bottleMl);
        const first = sizes.data[0].name;
        setSize(current => matching ?? (current || first));
    }, [sizes.data, bottleMl]);

    const previewRequest: LabelPreviewRequest | null = useMemo(() => (
        size && (form.includeFront || form.includeBack)
            ? {
                size,
                front: form.includeFront ? frontContent(form) : null,
                back: form.includeBack ? backContent(form) : null,
            }
            : null
    ), [form, size]);
    const previewKey = JSON.stringify(previewRequest);

    useEffect(() => {
        if (!previewRequest) {
            setPreview({ result: null, loading: false, error: null });
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setPreview(current => ({ ...current, loading: true }));
            api.previewLabels(previewRequest, controller.signal)
                .then(result => setPreview({ result, loading: false, error: null }))
                .catch(err => {
                    if (controller.signal.aborted) return;
                    console.error('Label preview failed:', err);
                    setPreview({ result: null, loading: false, error: requestFailure(err, t) });
                });
        }, PREVIEW_DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
        // previewKey stands for previewRequest's content.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewKey, t]);

    const errors = useMemo(() => {
        const refused = [sideError(preview.result?.front ?? null), sideError(preview.result?.back ?? null)];
        if (downloadError && typeof downloadError !== 'string') refused.push(downloadError);
        return fieldErrors(refused.filter((e): e is LabelError => e !== null), t);
    }, [preview.result, downloadError, t]);

    const update = <K extends keyof LabelForm>(field: K, value: LabelForm[K]) => {
        setForm(current => ({ ...current, [field]: value }));
        setDownloadError(null);
    };

    const chooseMedal = async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try {
            const medal = await medalPng(file);
            setForm(current => ({ ...current, medal, medalName: file.name }));
            setMedalError(null);
            setDownloadError(null);
        } catch (err) {
            console.error('Could not read the medal picture:', err);
            setMedalError(t('admin.labels.medalReadError'));
        }
    };

    const removeMedal = () => {
        setForm(current => ({ ...current, medal: '', medalName: '' }));
        setMedalError(null);
    };

    const chooseProduct = (id: string) => {
        setSearchParams(id ? { product: id } : {}, { replace: true });
    };

    const download = async () => {
        if (!previewRequest || !sizes.data) return;
        setDownloading(true);
        setDownloadError(null);
        try {
            const blob = await api.downloadLabelBundle({
                sizes: allSizes ? sizes.data.map(s => s.name) : [size],
                front: previewRequest.front,
                back: previewRequest.back,
            });
            saveBlob(blob, `${productId || 'labels'}-${allSizes ? 'all-sizes' : size}.zip`);
        } catch (err) {
            console.error('Label download failed:', err);
            const apiError = err as ApiError;
            setDownloadError(apiError.response?.status === 422
                ? apiError.response.data as unknown as LabelError
                : requestFailure(err, t));
        } finally {
            setDownloading(false);
        }
    };

    const text = (field: LabelTextField, options: { required?: boolean; helpText?: string; placeholder?: string } = {}) => (
        <TextInput
            id={`label-${field}`}
            label={t(`admin.labels.fields.${field}`)}
            required={options.required}
            placeholder={options.placeholder}
            helpText={options.helpText}
            error={errors[field]}
            value={form[field]}
            onChange={e => update(field, e.target.value)}
        />
    );

    if (sizes.error) {
        return (
            <div className="admin-content">
                <ErrorDisplay error={requestFailure(sizes.error, t)} onRetry={sizes.refetch} retryLabel={t('admin.products.retry')} />
            </div>
        );
    }

    const productOptions = [
        { value: '', label: t('admin.labels.noProduct') },
        ...(products.data ?? []).map(({ product }) => ({
            value: product.product_id,
            label: `${i18n.language === 'ro' ? product.product_name_ro : product.product_name} (${product.product_id})`,
        })),
    ];
    if (productId && !productOptions.some(option => option.value === productId)) {
        productOptions.push({ value: productId, label: productId });
    }

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-content">
                    <h1>{t('admin.labels.title')}</h1>
                    <p>{t('admin.labels.subtitle')}</p>
                </div>
            </div>

            <div className="labels-card labels-toolbar">
                <SelectInput
                    id="label-product"
                    label={t('admin.labels.product')}
                    helpText={t('admin.labels.productHelp')}
                    options={productOptions}
                    value={productId}
                    onChange={e => chooseProduct(e.target.value)}
                />
                <SelectInput
                    id="label-size"
                    label={t('admin.labels.size')}
                    options={(sizes.data ?? []).map(s => ({
                        value: s.name,
                        label: t('admin.labels.sizeOption', {
                            front: s.front_mm.join('×'),
                            back: s.back_mm.join('×'),
                            volume: s.volume_cl,
                        }),
                    }))}
                    value={size}
                    onChange={e => setSize(e.target.value)}
                />
            </div>

            <div className="labels-workspace">
                <div className="labels-forms">
                    <section className="labels-card">
                        <h3>{t('admin.labels.bottle')}</h3>
                        <div className="labels-fields">
                            {text('alcoholPercent', { required: true, placeholder: '10,5' })}
                            {text('volumeMl', { helpText: t('admin.labels.help.volumeMl'), placeholder: '750' })}
                        </div>
                    </section>

                    <section className="labels-card">
                        <div className="labels-side-header">
                            <h3>{t('admin.labels.front')}</h3>
                            <label className="labels-checkbox">
                                <input type="checkbox" checked={form.includeFront} onChange={e => update('includeFront', e.target.checked)} />
                                {t('admin.labels.include')}
                            </label>
                        </div>
                        {form.includeFront && (
                            <div className="labels-fields">
                                {text('preTitle', { helpText: t('admin.labels.help.preTitle'), placeholder: 'Mied cu' })}
                                {text('variantLine1', { required: true, helpText: t('admin.labels.help.variantLine1') })}
                                {text('variantLine2', { helpText: t('admin.labels.help.variantLine2') })}
                                {text('sweetness', { required: true, placeholder: 'Demidulce' })}
                                {text('effervescence', { helpText: t('admin.labels.help.effervescence'), placeholder: 'Ușor Spumant' })}
                                {text('bottlingDate', { required: true, placeholder: 'Noiembrie 2025' })}
                                <TextInput
                                    id="label-stripeColor"
                                    type="color"
                                    label={t('admin.labels.fields.stripeColor')}
                                    className="labels-color"
                                    error={errors.stripeColor}
                                    value={form.stripeColor}
                                    onChange={e => update('stripeColor', e.target.value)}
                                />
                                <FormField
                                    id="label-medal"
                                    label={t('admin.labels.fields.medal')}
                                    helpText={t('admin.labels.help.medal')}
                                    error={medalError ?? errors.medal}
                                >
                                    {({ describedBy }) => (
                                        <div className="labels-medal">
                                            <input
                                                id="label-medal"
                                                type="file"
                                                accept={MEDAL_FILE_TYPES}
                                                aria-describedby={describedBy}
                                                aria-invalid={medalError ?? errors.medal ? true : undefined}
                                                onChange={e => void chooseMedal(e.currentTarget)}
                                            />
                                            {form.medalName && (
                                                <p className="labels-medal-chosen">
                                                    <span>{form.medalName}</span>
                                                    <button type="button" className="button button-small button-secondary" onClick={removeMedal}>
                                                        {t('admin.labels.removeMedal')}
                                                    </button>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </FormField>
                            </div>
                        )}
                    </section>

                    <section className="labels-card">
                        <div className="labels-side-header">
                            <h3>{t('admin.labels.back')}</h3>
                            <label className="labels-checkbox">
                                <input type="checkbox" checked={form.includeBack} onChange={e => update('includeBack', e.target.checked)} />
                                {t('admin.labels.include')}
                            </label>
                        </div>
                        {form.includeBack && (
                            <div className="labels-fields">
                                {text('producerName', { required: true })}
                                {text('addressLine1', { required: true })}
                                {text('addressLine2')}
                                {text('lotCode', { required: true, helpText: t('admin.labels.help.lotCode') })}
                                {text('ean', { required: true, helpText: t('admin.labels.help.ean') })}
                                {text('qrUrl', { required: true, helpText: t('admin.labels.help.qrUrl') })}
                                <label className="labels-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={form.containsSulfites}
                                        onChange={e => update('containsSulfites', e.target.checked)}
                                    />
                                    {t('admin.labels.fields.containsSulfites')}
                                </label>
                                <p className="help-text">{t('admin.labels.help.containsSulfites')}</p>
                            </div>
                        )}
                    </section>

                    <section className="labels-card">
                        <h3>{t('admin.labels.download')}</h3>
                        <label className="labels-checkbox">
                            <input type="checkbox" checked={allSizes} onChange={e => setAllSizes(e.target.checked)} />
                            {t('admin.labels.allSizes')}
                        </label>
                        <p className="help-text">{t('admin.labels.downloadHelp')}</p>
                        {downloadError && (
                            <p className="label-preview-error" role="alert">
                                {typeof downloadError === 'string' ? downloadError : labelErrorMessage(downloadError, t)}
                            </p>
                        )}
                        <button
                            type="button"
                            className="button"
                            onClick={download}
                            disabled={!previewRequest || downloading}
                        >
                            {downloading ? t('admin.labels.downloading') : t('admin.labels.downloadButton')}
                        </button>
                    </section>
                </div>

                <div className="labels-previews">
                    {preview.error && <p className="label-preview-error" role="alert">{preview.error}</p>}
                    {form.includeFront && (
                        <PreviewPanel side="front" result={preview.result?.front ?? null} loading={preview.loading} />
                    )}
                    {form.includeBack && (
                        <PreviewPanel side="back" result={preview.result?.back ?? null} loading={preview.loading} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminLabels;
