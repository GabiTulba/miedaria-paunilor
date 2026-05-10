import { registerLocale } from 'react-datepicker';
import { ro } from 'date-fns/locale/ro';
import { enUS } from 'date-fns/locale/en-US';

// One-time global registration of date-picker locales. Importing this module
// from any caller is enough — react-datepicker reads the registry by string key.
registerLocale('en', enUS);
registerLocale('ro', ro);

// Returns today as YYYY-MM-DD (used as the default bottling_date when creating a new product).
export function getTodayIsoDate(): string {
    return new Date().toISOString().split('T')[0];
}
