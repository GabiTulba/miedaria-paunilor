import type en from './locales/en.json';
import type ro from './locales/ro.json';

// EN is the canonical key tree; `t()` keys typecheck against it via the
// module augmentation below (JSON shape comes from resolveJsonModule).
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: typeof en;
        };
    }
}

// Compile-time parity check: each locale must cover the other's key tree.
type Covers<T extends U, U> = T;
export type RoCoversEn = Covers<typeof ro, typeof en>;
export type EnCoversRo = Covers<typeof en, typeof ro>;
