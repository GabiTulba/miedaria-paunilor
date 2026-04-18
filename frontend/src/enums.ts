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

// Helper function to get enum label from value based on language
// Uses translation files for labels
export function getEnumLabel(value: string, enumType: keyof EnumValues, t: (key: string) => string): string {
    const translationKey = `enums.${enumType}.${value}`;
    const translated = t(translationKey);
    
    // If translation is not found, fall back to formatted value
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