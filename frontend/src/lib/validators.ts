// Form-field validators shared by ProductForm and BlogForm.
// Returns a string error message when invalid, undefined when valid.

export function validateRequired(value: string, fieldName: string): string | undefined {
    if (!value.trim()) return `${fieldName} is required`;
    return undefined;
}

export function validateProductId(value: string): string | undefined {
    if (!value.trim()) return 'Product ID is required';
    if (!/^[a-z0-9_-]+$/.test(value)) return 'Only lowercase letters, numbers, dashes, underscores';
    if (value.length > 128) return 'Max 128 characters';
    return undefined;
}

export function validateAbv(value: string): string | undefined {
    const num = parseFloat(value);
    if (isNaN(num)) return 'ABV is required';
    if (num < 0 || num > 99.9) return 'ABV must be 0.0–99.9';
    return undefined;
}

export function validatePositiveNumber(value: string, fieldName: string): string | undefined {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return `${fieldName} must be positive`;
    return undefined;
}

export function validateNonNegative(value: string, fieldName: string): string | undefined {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return `${fieldName} must be non-negative`;
    return undefined;
}

// Mirror of `is_valid_ean13` in backend/src/utils.rs: 13 digits, the last
// being the check digit. Blank is valid (the code is optional).
export function validateEan13(value: string | null): string | undefined {
    if (!value) return undefined;
    if (!/^\d{13}$/.test(value)) return 'EAN-13 must be 13 digits';
    const weighted = [...value.slice(0, 12)].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0);
    if ((10 - (weighted % 10)) % 10 !== Number(value[12])) return 'EAN-13 check digit is wrong';
    return undefined;
}

// react-hook-form register options for number inputs: store a number in form
// state (empty input collapses to 0, matching the old handleNumericChange) and
// adapt the string-based validators above to the numeric stored value.
export const emptyToZero = (value: unknown): number =>
    value === '' || value == null ? 0 : Number(value);

export function numericOptions(validate?: (value: string) => string | undefined) {
    return {
        setValueAs: emptyToZero,
        ...(validate ? { validate: (value: number) => validate(String(value)) } : {}),
    };
}

// Mirror of `is_valid_slug` in backend/src/utils.rs (kebab-case + underscores allowed).
export function validateSlug(value: string, max = 256): string | undefined {
    if (!value.trim()) return 'Slug is required';
    if (!/^[a-z0-9_-]+$/.test(value)) return 'Only lowercase letters, numbers, hyphens, underscores';
    if (value.length > max) return `Max ${max} characters`;
    return undefined;
}
