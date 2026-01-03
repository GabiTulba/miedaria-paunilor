/**
 * Utility functions for date formatting and parsing
 */

/**
 * Converts a date from YYYY-MM-DD format (backend) to DD/MM/YYYY format (UI)
 */
export function formatDateForDisplay(isoDate: string): string {
    if (!isoDate || isoDate.trim() === '') {
        return '';
    }
    
    // Try to parse as YYYY-MM-DD
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        // Validate parts are numbers
        if (!isNaN(Number(year)) && !isNaN(Number(month)) && !isNaN(Number(day))) {
            return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        }
    }
    
    // If it's already in DD/MM/YYYY format, return as is
    const ddmmParts = isoDate.split('/');
    if (ddmmParts.length === 3) {
        const [day, month, year] = ddmmParts;
        if (!isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
            return isoDate; // Already in correct format
        }
    }
    
    // If we can't parse it, return empty string
    return '';
}

/**
 * Converts a date from DD/MM/YYYY format (UI) to YYYY-MM-DD format (backend)
 * Returns empty string if invalid
 */
export function parseDateForBackend(displayDate: string): string {
    if (!displayDate || displayDate.trim() === '') {
        return '';
    }
    
    const parts = displayDate.split('/');
    if (parts.length !== 3) {
        return '';
    }
    
    const [day, month, year] = parts;
    
    // Validate all parts are numbers
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
        return '';
    }
    
    // Basic validation
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1000 || yearNum > 9999) {
        return '';
    }
    
    // Format as YYYY-MM-DD
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Validates if a date string is in DD/MM/YYYY format
 */
export function isValidDisplayDate(dateStr: string): boolean {
    if (!dateStr || dateStr.trim() === '') {
        return false;
    }
    
    const parsed = parseDateForBackend(dateStr);
    if (!parsed) {
        return false;
    }
    
    // Additional validation: check if it's a valid date
    const date = new Date(parsed);
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Gets today's date in DD/MM/YYYY format
 */
export function getTodayDisplayDate(): string {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Gets today's date in YYYY-MM-DD format (for backend)
 */
export function getTodayIsoDate(): string {
    return new Date().toISOString().split('T')[0];
}