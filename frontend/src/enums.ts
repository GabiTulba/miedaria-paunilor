import type { EnumValues } from './types/generated/EnumValues';

export type { EnumValue } from './types/generated/EnumValue';
export type { EnumValues } from './types/generated/EnumValues';

const EXPECTED_ENUM_KEYS: ReadonlyArray<keyof EnumValues> = [
    'mead_type', 'sweetness', 'turbidity', 'effervescence', 'acidity', 'tannins', 'body',
];

// Runtime guard for the GET /enums payload; the generated EnumValues type
// only exists at compile time.
export function validateEnumResponse(response: unknown): response is EnumValues {
    return (
        typeof response === 'object' &&
        response !== null &&
        EXPECTED_ENUM_KEYS.every(key => Array.isArray((response as Record<string, unknown>)[key]))
    );
}

const ENUM_TYPE_TO_TRANSLATION_KEY: Record<keyof EnumValues, string> = {
    mead_type: 'meadType',
    sweetness: 'sweetness',
    turbidity: 'turbidity',
    effervescence: 'effervescence',
    acidity: 'acidity',
    tannins: 'tannins',
    body: 'body',
};

export function getEnumLabel(value: string, enumType: keyof EnumValues, t: (key: string) => string): string {
    const translationPrefix = ENUM_TYPE_TO_TRANSLATION_KEY[enumType];
    const translationKey = `enums.${translationPrefix}.${value}`;
    const translated = t(translationKey);

    if (translated === translationKey) {
        return formatEnumLabel(value);
    }

    return translated;
}

export function formatEnumLabel(value: string): string {
    return value
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}
