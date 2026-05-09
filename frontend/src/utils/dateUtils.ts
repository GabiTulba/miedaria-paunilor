// Returns today as YYYY-MM-DD (used as the default bottling_date when creating a new product).
export function getTodayIsoDate(): string {
    return new Date().toISOString().split('T')[0];
}
