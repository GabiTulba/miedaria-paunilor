import { useTranslation } from 'react-i18next';
import './Pagination.css';

interface PaginationProps {
    page: number;
    hasMore: boolean;
    totalPages?: number;
    onPrevPage: () => void;
    onNextPage: () => void;
    // When true, scroll to top after the page changes (used on long lists like
    // Shop and Blog so the user lands at the start of the new page).
    scrollOnChange?: boolean;
}

function Pagination({ page, hasMore, totalPages, onPrevPage, onNextPage, scrollOnChange }: PaginationProps) {
    const { t } = useTranslation();
    const handlePrev = () => {
        onPrevPage();
        if (scrollOnChange) window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleNext = () => {
        onNextPage();
        if (scrollOnChange) window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    return (
        <nav className="pagination-section" aria-label={t('common.pagination')}>
            <div className="pagination">
                <button
                    className="pagination-btn"
                    onClick={handlePrev}
                    disabled={page === 1}
                    aria-label={t('common.previousPage')}
                >
                    ← {t('common.previous')}
                </button>
                <span className="pagination-page" aria-current="page">
                    {t('common.page')} {page}{totalPages ? ` ${t('common.of')} ${totalPages}` : ''}
                </span>
                <button
                    className="pagination-btn"
                    onClick={handleNext}
                    disabled={!hasMore}
                    aria-label={t('common.nextPage')}
                >
                    {t('common.next')} →
                </button>
            </div>
        </nav>
    );
}

export default Pagination;
