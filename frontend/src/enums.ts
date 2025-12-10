// Type definitions for enum values fetched from backend API
// These types match the backend's EnumValue and EnumValues structures

export interface EnumValue {
    value: string;
    label: string;
}

export interface EnumValues {
    mead_type: EnumValue[];
    sweetness: EnumValue[];
    turbidity: EnumValue[];
    effervescence: EnumValue[];
    acidity: EnumValue[];
    tanins: EnumValue[];
    body: EnumValue[];
}

// Helper function to get enum label from value
export function getEnumLabel(value: string, enumValues: EnumValue[]): string {
    const enumValue = enumValues.find(e => e.value === value);
    return enumValue ? enumValue.label : value;
}

// Fallback formatting for enum labels when enum values are not available
export function formatEnumLabel(value: string): string {
    return value
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}