// Soft-deleted products are eligible for permanent deletion this many days after deletion.
// Mirror of `Duration::days(7)` in backend/src/product_crud.rs (~line 401).
export const HARD_DELETE_GRACE_DAYS = 7;

export function addGraceDays(date: Date): Date {
    return new Date(date.getTime() + HARD_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
}
