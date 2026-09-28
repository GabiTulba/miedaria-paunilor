import { useTranslation } from 'react-i18next';
import { useFormattedDate } from '../hooks/useFormattedDate';
import type { LocalizedProduct } from '../types';
import './EurConversionNote.css';

interface EurConversionNoteProps {
    products: Pick<LocalizedProduct, 'is_converted' | 'rate_date'>[];
}

/** Footnote for the `*` on indicative EUR prices; renders nothing when no price shown is converted. */
function EurConversionNote({ products }: EurConversionNoteProps) {
    const { t } = useTranslation();
    const formatDate = useFormattedDate();

    // ISO dates compare correctly as strings; the newest rate is the one quoted.
    const rateDate = products.reduce<string | null>(
        (latest, p) => (p.is_converted && p.rate_date && (!latest || p.rate_date > latest) ? p.rate_date : latest),
        null,
    );
    if (!rateDate) return null;

    return <p className="eur-conversion-note">{t('product.eurConversionNote', { date: formatDate(rateDate) })}</p>;
}

export default EurConversionNote;
