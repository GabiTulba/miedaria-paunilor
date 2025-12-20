/**
 * Safely converts a value to a number, handling both string and number inputs.
 * Returns 0 if the value cannot be converted.
 */
export function toNumber(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safely converts a value to a fixed decimal string.
 * Returns "0.00" if the value cannot be converted.
 */
export function toFixed(value: number | string, decimals: number = 2): string {
  return toNumber(value).toFixed(decimals);
}