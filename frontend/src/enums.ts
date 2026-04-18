// Type definitions for enum values fetched from backend API
// These types match the backend's EnumValue and EnumValues structures

export interface EnumValue {
    value: string;
}

export interface EnumValues {
    mead_type: EnumValue[];
    sweetness: EnumValue[];
    turbidity: EnumValue[];
    effervescence: EnumValue[];
    acidity: EnumValue[];
    tannins: EnumValue[];
    body: EnumValue[];
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

// Fallback formatting for enum labels when enum values are not available
export function formatEnumLabel(value: string): string {
    return value
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}