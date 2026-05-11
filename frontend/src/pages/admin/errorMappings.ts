import type { TFunction } from 'i18next';
import type { BlogPost, Product } from '../../types';
import type { BlogValidationError } from '../../types/generated/BlogValidationError';
import type { ProductValidationError } from '../../types/generated/ProductValidationError';

// Backend ProductValidationError variant -> form field name. Exhaustive: TS will
// fail to compile if a new variant is added on the backend without a mapping
// entry here.
export const errorMapping: Record<ProductValidationError, keyof Product> = {
    InvalidProductId: 'product_id',
    ProductIdTooLong: 'product_id',
    EmptyProductName: 'product_name',
    ProductNameTooLong: 'product_name',
    EmptyProductNameRo: 'product_name_ro',
    ProductNameRoTooLong: 'product_name_ro',
    EmptyProductDescription: 'product_description',
    EmptyProductDescriptionRo: 'product_description_ro',
    EmptyIngredients: 'ingredients',
    EmptyIngredientsRo: 'ingredients_ro',
    InvalidAbv: 'abv',
    InvalidAbvPrecision: 'abv',
    InvalidBottleCount: 'bottle_count',
    BottleCountTooLarge: 'bottle_count',
    InvalidBottleSize: 'bottle_size',
    InvalidPrice: 'price',
    InvalidPricePrecision: 'price',
    PriceBelowMinimum: 'price',
    InvalidPriceRon: 'price_ron',
    InvalidPriceRonPrecision: 'price_ron',
    PriceRonBelowMinimum: 'price_ron',
    InvalidBottlingDate: 'bottling_date',
    InvalidLotNumber: 'lot_number',
};

export const blogErrorMapping: Record<BlogValidationError, keyof BlogPost> = {
    EmptyTitle: 'title',
    TitleTooLong: 'title',
    EmptyTitleRo: 'title_ro',
    TitleRoTooLong: 'title_ro',
    EmptySlug: 'slug',
    SlugTooLong: 'slug',
    InvalidSlug: 'slug',
    EmptyContent: 'content_markdown',
    ContentTooLarge: 'content_markdown',
    EmptyContentRo: 'content_markdown_ro',
    ContentRoTooLarge: 'content_markdown_ro',
    EmptyExcerpt: 'excerpt',
    ExcerptTooLong: 'excerpt',
    EmptyExcerptRo: 'excerpt_ro',
    ExcerptRoTooLong: 'excerpt_ro',
    EmptyAuthor: 'author',
    AuthorTooLong: 'author',
};

interface BackendErrorShape {
    response?: {
        data?: {
            errors?: string[];
        };
    };
}

// Reduce a backend validation-error response into a `{field: message}` map suitable
// for form state. Looks up the i18n key `errors.<scope>.<Variant>`; returns null
// when the error doesn't contain a `data.errors` array (caller should fall back
// to the top-level message).
export function mapBackendValidationErrors(
    err: unknown,
    fieldMapping: Record<string, string>,
    t: TFunction,
    scope: 'product' | 'blog',
): Record<string, string> | null {
    const backendErrors = (err as BackendErrorShape)?.response?.data?.errors;
    if (!Array.isArray(backendErrors)) return null;
    const out: Record<string, string> = {};
    for (const code of backendErrors) {
        const field = fieldMapping[code];
        if (!field) continue;
        out[field] = t(`errors.${scope}.${code}`, { defaultValue: code });
    }
    return out;
}
