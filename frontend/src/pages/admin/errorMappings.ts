import { Product } from '../../types';

export const errorMapping: Record<string, keyof Product> = {
    InvalidProductId: "product_id",
    EmptyProductName: "product_name",
    EmptyProductNameRo: "product_name_ro",
    EmptyProductDescription: "product_description",
    EmptyProductDescriptionRo: "product_description_ro",
    EmptyIngredients: "ingredients",
    EmptyIngredientsRo: "ingredients_ro",
    InvalidProductType: "product_type",
    InvalidSweetnessType: "sweetness",

    InvalidTurbidityType: "turbidity",
    InvalidEffervescenceType: "effervescence",
    InvalidAcidityType: "acidity",
    InvalidTaninsType: "tannins",
    InvalidBodyType: "body",
    InvalidAbv: "abv",
    InvalidBottleCount: "bottle_count",
    InvalidBottleSize: "bottle_size",
    InvalidPrice: "price",
    InvalidPriceRon: "price_ron",
    InvalidAbvPrecision: "abv",
    InvalidPricePrecision: "price",
    InvalidPriceRonPrecision: "price_ron",
};

export const errorMessageMapping: Record<string, string> = {
    InvalidProductId: "Product ID can only contain lowercase letters, dashes and underscores.",
    EmptyProductName: "English product name cannot be empty.",
    EmptyProductNameRo: "Romanian product name cannot be empty.",
    EmptyProductDescription: "English product description cannot be empty.",
    EmptyProductDescriptionRo: "Romanian product description cannot be empty.",
    EmptyIngredients: "English ingredients cannot be empty.",
    EmptyIngredientsRo: "Romanian ingredients cannot be empty.",
    InvalidProductType: "Invalid mead type selected.",
    InvalidSweetnessType: "Invalid sweetness type selected.",

    InvalidTurbidityType: "Invalid turbidity type selected.",
    InvalidEffervescenceType: "Invalid effervescence type selected.",
    InvalidAcidityType: "Invalid acidity type selected.",
    InvalidTaninsType: "Invalid tannins type selected.",
    InvalidBodyType: "Invalid body type selected.",
    InvalidAbv: "ABV must be between 0.0 and 99.9.",
    InvalidBottleCount: "Bottle count must be a non-negative integer.",
    InvalidBottleSize: "Bottle size must be a positive integer.",
    InvalidPrice: "EUR price must be between 0.00 and 999.99.",
    InvalidPriceRon: "RON price must be between 0.00 and 99999.99.",
    InvalidAbvPrecision: "ABV must have at most 1 decimal place.",
    InvalidPricePrecision: "EUR price must have at most 2 decimal places.",
    InvalidPriceRonPrecision: "RON price must have at most 2 decimal places.",
};

// Backend blog ProductValidationError-style enum -> form field name. Mirror of
// blog_crud.rs validation variants (EmptyTitle, InvalidSlug, ...).
export const blogErrorMapping: Record<string, string> = {
    EmptyTitle: 'title',
    EmptyTitleRo: 'title_ro',
    EmptySlug: 'slug',
    InvalidSlug: 'slug',
    EmptyContent: 'content_markdown',
    EmptyContentRo: 'content_markdown_ro',
    EmptyExcerpt: 'excerpt',
    EmptyExcerptRo: 'excerpt_ro',
    EmptyAuthor: 'author',
    TitleTooLong: 'title',
    TitleRoTooLong: 'title_ro',
    SlugTooLong: 'slug',
    ExcerptTooLong: 'excerpt',
    ExcerptRoTooLong: 'excerpt_ro',
    AuthorTooLong: 'author',
};

export const blogErrorMessageMapping: Record<string, string> = {
    EmptyTitle: 'English title cannot be empty.',
    EmptyTitleRo: 'Romanian title cannot be empty.',
    EmptySlug: 'Slug cannot be empty.',
    InvalidSlug: 'Invalid slug format.',
    EmptyContent: 'English content cannot be empty.',
    EmptyContentRo: 'Romanian content cannot be empty.',
    EmptyExcerpt: 'English excerpt cannot be empty.',
    EmptyExcerptRo: 'Romanian excerpt cannot be empty.',
    EmptyAuthor: 'Author cannot be empty.',
    TitleTooLong: 'English title is too long.',
    TitleRoTooLong: 'Romanian title is too long.',
    SlugTooLong: 'Slug is too long.',
    ExcerptTooLong: 'English excerpt is too long.',
    ExcerptRoTooLong: 'Romanian excerpt is too long.',
    AuthorTooLong: 'Author is too long.',
};

interface BackendErrorShape {
    response?: {
        data?: {
            errors?: string[];
        };
    };
}

// Reduce a backend validation-error response into a `{field: message}` map suitable
// for form state. Returns null when the error doesn't contain a `data.errors` array
// (caller should fall back to the top-level message).
export function mapBackendValidationErrors(
    err: unknown,
    fieldMapping: Record<string, string>,
    messageMapping: Record<string, string>,
): Record<string, string> | null {
    const backendErrors = (err as BackendErrorShape)?.response?.data?.errors;
    if (!Array.isArray(backendErrors)) return null;
    const out: Record<string, string> = {};
    for (const code of backendErrors) {
        const field = fieldMapping[code];
        if (!field) continue;
        out[field] = messageMapping[code] ?? code;
    }
    return out;
}
