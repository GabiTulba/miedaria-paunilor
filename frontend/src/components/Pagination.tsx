import { useTranslation } from 'react-i18next';
import './Pagination.css';

interface PaginationProps {
    page: number;
    hasMore: boolean;
    onPrevPage: () => void;
    onNextPage: () => void;
}

function Pagination({ page, hasMore, onPrevPage, onNextPage }: PaginationProps) {
    const { t } = useTranslation();
    return (
        <nav className="pagination-section" aria-label={t('common.pagination')}>
            <div className="pagination">
                <button
                    className="pagination-btn"
                    onClick={onPrevPage}
                    disabled={page === 1}
                    aria-label={t('common.previousPage')}
                >
                    ← {t('common.previous')}
                </button>
                <span className="pagination-page" aria-current="page">{t('common.page')} {page}</span>
                <button
                    className="pagination-btn"
                    onClick={onNextPage}
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
