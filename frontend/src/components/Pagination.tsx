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
        <div className="pagination-section">
            <div className="pagination">
                <button
                    className="pagination-btn"
                    onClick={onPrevPage}
                    disabled={page === 1}
                >
                    ← {t('common.previous')}
                </button>
                <span className="pagination-page">{t('common.page')} {page}</span>
                <button
                    className="pagination-btn"
                    onClick={onNextPage}
                    disabled={!hasMore}
                >
                    {t('common.next')} →
                </button>
            </div>
        </div>
    );
}

export default Pagination;
