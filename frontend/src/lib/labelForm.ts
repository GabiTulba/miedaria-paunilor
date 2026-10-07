import i18n from '../i18n/config';
import { getEnumLabel } from '../enums';
import { BUSINESS_INFO, BUSINESS_LEGAL } from './businessInfo';
import { getOrigin } from './origin';
import type { Product } from '../types/models';
import type { BackLabelContent } from '../types/generated/BackLabelContent';
import type { FrontLabelContent } from '../types/generated/FrontLabelContent';

/// The artwork's default color of the stripe behind the variant name.
export const DEFAULT_STRIPE_COLOR = '#355243';
/// The pre-title of most product names ("Mied cu Mentă & Cacao").
const PRE_TITLE = 'Mied cu';

/// Everything the admin label tool edits. The ABV and volume are shared, so
/// the front and back labels can't disagree; an empty volume prints each
/// label size's bottle volume.
export interface LabelForm {
    includeFront: boolean;
    includeBack: boolean;
    preTitle: string;
    variantLine1: string;
    variantLine2: string;
    sweetness: string;
    effervescence: string;
    stripeColor: string;
    bottlingDate: string;
    alcoholPercent: string;
    volumeMl: string;
    producerName: string;
    addressLine1: string;
    addressLine2: string;
    lotCode: string;
    ean: string;
    qrUrl: string;
    containsSulfites: boolean;
}

export type LabelFormField = Exclude<keyof LabelForm, 'includeFront' | 'includeBack'>;
export type LabelTextField = { [K in LabelFormField]: LabelForm[K] extends string ? K : never }[LabelFormField];

export function emptyLabelForm(): LabelForm {
    return {
        includeFront: true,
        includeBack: true,
        preTitle: PRE_TITLE,
        variantLine1: '',
        variantLine2: '',
        sweetness: '',
        effervescence: '',
        stripeColor: DEFAULT_STRIPE_COLOR,
        bottlingDate: '',
        alcoholPercent: '',
        volumeMl: '',
        producerName: BUSINESS_LEGAL.legalName,
        addressLine1: `${BUSINESS_INFO.streetAddress}, ${BUSINESS_INFO.locality}`,
        addressLine2: `Jud. ${BUSINESS_INFO.county}, ${BUSINESS_INFO.countryName}`,
        lotCode: '',
        ean: '',
        qrUrl: '',
        containsSulfites: true,
    };
}

/// Labels are printed in Romanian whatever the admin's language.
const romanian = () => i18n.getFixedT('ro');

const decimalComma = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/// "2025-11-03" -> "Noiembrie 2025".
function monthAndYear(isoDate: string): string {
    const [year, month] = isoDate.split('-').map(Number);
    const monthName = new Intl.DateTimeFormat('ro', { month: 'long', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month - 1, 1)));
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

/// A product name as the front label sets it: "Mied cu Mentă & Cacao" ->
/// pre-title "Mied cu", stripe lines "Mentă" and "& Cacao".
function nameParts(name: string): Pick<LabelForm, 'preTitle' | 'variantLine1' | 'variantLine2'> {
    const trimmed = name.trim();
    const hasPreTitle = trimmed.toLocaleLowerCase('ro').startsWith(`${PRE_TITLE.toLocaleLowerCase('ro')} `);
    const rest = hasPreTitle ? trimmed.slice(PRE_TITLE.length).trim() : trimmed;
    const ampersand = rest.indexOf(' & ');
    return {
        preTitle: hasPreTitle ? trimmed.slice(0, PRE_TITLE.length) : '',
        variantLine1: ampersand < 0 ? rest : rest.slice(0, ampersand),
        variantLine2: ampersand < 0 ? '' : rest.slice(ampersand + 1),
    };
}

/// `form` with the product's label content filled in; the producer, stripe
/// color and chosen sides are kept. The effervescence is typed by hand, so
/// it is cleared rather than carried over from another product. The lot code and QR link match the
/// public lot page (`/lot/{lot_number}`).
export function withProduct(form: LabelForm, product: Product): LabelForm {
    return {
        ...form,
        ...nameParts(product.product_name_ro),
        sweetness: getEnumLabel(product.sweetness, 'sweetness', romanian()),
        effervescence: '',
        bottlingDate: monthAndYear(product.bottling_date),
        alcoholPercent: decimalComma(product.abv, 1),
        volumeMl: String(product.bottle_size),
        lotCode: `L${product.lot_number}`,
        ean: product.ean_code ?? '',
        qrUrl: `${getOrigin()}/lot/${product.lot_number}`,
    };
}

/// One or two lines, as typed: a blank second line is left out.
const lines = (first: string, second: string) => (second.trim() ? [first, second] : [first]);

/// "750" ml -> "75" cl, "375" -> "37,5"; anything else is passed on for the
/// renderer to reject.
function centiliters(milliliters: string): string {
    if (!/^\d+$/.test(milliliters)) return milliliters;
    const ml = Number(milliliters);
    return decimalComma(ml / 10, ml % 10 ? 1 : 0);
}

export function frontContent(form: LabelForm): FrontLabelContent {
    const volume = form.volumeMl.trim();
    return {
        pre_title: form.preTitle.trim() ? form.preTitle : null,
        variant_lines: lines(form.variantLine1, form.variantLine2),
        sweetness: form.sweetness,
        effervescence: form.effervescence.trim() ? form.effervescence : null,
        stripe_color: form.stripeColor,
        bottling_date: form.bottlingDate,
        alcohol_percent: form.alcoholPercent,
        volume_cl: volume ? centiliters(volume) : null,
    };
}

export function backContent(form: LabelForm): BackLabelContent {
    return {
        producer_name: form.producerName,
        address_lines: lines(form.addressLine1, form.addressLine2),
        lot_code: form.lotCode,
        ean: form.ean,
        qr_url: form.qrUrl,
        alcohol_percent: form.alcoholPercent,
        volume_ml: form.volumeMl.trim() || null,
        contains_sulfites: form.containsSulfites,
    };
}

/// The renderer's field path (`back.ean`, `front.variant_lines.1`) as the
/// form field it came from.
const FIELD_PATHS: Record<string, LabelFormField> = {
    'front.pre_title': 'preTitle',
    'front.variant_lines': 'variantLine1',
    'front.variant_lines.0': 'variantLine1',
    'front.variant_lines.1': 'variantLine2',
    'front.sweetness': 'sweetness',
    'front.effervescence': 'effervescence',
    'front.stripe_color': 'stripeColor',
    'front.bottling_date': 'bottlingDate',
    'front.alcohol_percent': 'alcoholPercent',
    'front.volume_cl': 'volumeMl',
    'back.producer_name': 'producerName',
    'back.address_lines': 'addressLine1',
    'back.address_lines.0': 'addressLine1',
    'back.address_lines.1': 'addressLine2',
    'back.lot_code': 'lotCode',
    'back.ean': 'ean',
    'back.qr_url': 'qrUrl',
    'back.alcohol_percent': 'alcoholPercent',
    'back.volume_ml': 'volumeMl',
    'back.contains_sulfites': 'containsSulfites',
};

export const formField = (path: string): LabelFormField | undefined => FIELD_PATHS[path];
