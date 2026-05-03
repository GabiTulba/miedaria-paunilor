import { useEffect, useState, useContext, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '../../types';
import { api } from '../../lib/api';
import { useFormattedDate } from '../../hooks/useFormattedDate';
import { useLanguage } from '../../hooks/useLanguage';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Pagination from '../../components/Pagination';
import ErrorDisplay from '../../components/ErrorDisplay';
import ConfirmModal from '../../components/ConfirmModal';
import './Admin.css';

const ADMIN_BLOG_PER_PAGE = 20;

function AdminBlog() {
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const { t } = useTranslation();
    const { showToast } = useToast();
    const language = useLanguage();
    const formatDateOptions = useMemo(() => ({
        year: 'numeric' as const,
        month: 'short' as const,
        day: 'numeric' as const,
    }), []);
    const formatDate = useFormattedDate(formatDateOptions);
    const { token } = useContext(AuthContext);

    useEffect(() => {
        const controller = new AbortController();
        const fetchBlogPosts = async () => {
            if (!token) return;

            try {
                setLoading(true);
                const data = await api.getBlogPostsAdmin(token, page, ADMIN_BLOG_PER_PAGE, controller.signal);
                setTotalPages(data.total_pages ?? 1);
                setHasMore(page < (data.total_pages ?? 1));
                setBlogPosts(data.items ?? []);
                setError(null);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error("Failed to fetch blog posts:", err);
                setError(t('admin.products.error'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        fetchBlogPosts();
        return () => { controller.abort(); };
    }, [token, t, page, fetchTrigger]);

    const getLocalizedTitle = (post: BlogPost) => {
        return language === 'ro' ? post.title_ro : post.title;
    };

    const handleDeleteClick = (id: string) => {
        if (!token) return;
        setConfirmDeleteId(id);
    };

    const handleConfirmDelete = async () => {
        if (!confirmDeleteId || !token) return;
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        try {
            setActionError(null);
            await api.deleteBlogPost(id, token);
            showToast(t('admin.blog.deleteSuccess'), 'success');
            if (blogPosts.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                setFetchTrigger(n => n + 1);
            }
        } catch (err) {
            console.error("Failed to delete blog post:", err);
            setActionError(t('common.error'));
        }
    };

    if (error) {
        return (
            <div className="admin-content">
                <ErrorDisplay
                    error={error}
                    onRetry={() => setFetchTrigger(n => n + 1)}
                    retryLabel={t('admin.products.retry')}
                />
            </div>
        );
    }

    return (
        <div className="admin-content">
            <div className="admin-header">
                <div className="header-content">
                    <h1>{t('admin.blog.title')}</h1>
                    <p>{t('admin.blog.subtitle')}</p>
                </div>
                <div className="header-actions">
                    <Link to="/admin/dashboard/blog/create" className="button">
                        {t('admin.blog.createNew')}
                    </Link>
                </div>
            </div>

            {actionError && (
                <div className="message message-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{actionError}</span>
                    <button onClick={() => setActionError(null)} className="button button-small button-secondary" style={{ marginLeft: '1rem' }}>
                        {t('common.close')}
                    </button>
                </div>
            )}

            {blogPosts.length === 0 && page === 1 && !loading ? (
                <div className="empty-state">
                    <div className="empty-state-icon blog-empty-icon"></div>
                    <h3>{t('admin.blog.noPosts')}</h3>
                    <p>{t('admin.blog.noPostsDescription')}</p>
                    <Link to="/admin/dashboard/blog/create" className="button">
                        {t('admin.blog.createFirst')}
                    </Link>
                </div>
            ) : loading ? (
                <div className="loading-state">
                    <div className="loading-icon"></div>
                    <p>{t('common.loading')}</p>
                </div>
            ) : (
                <>
                <div className="admin-table-container">
                    <table className="admin-table">
                        <colgroup>
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '20%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>{t('admin.blog.table.title')}</th>
                                <th>{t('admin.blog.table.author')}</th>
                                <th>{t('admin.blog.table.published')}</th>
                                <th>{t('admin.blog.table.status')}</th>
                                <th>{t('admin.blog.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {blogPosts.map((post) => (
                                <tr key={post.id}>
                                    <td>
                                        <div className="product-cell">
                                            <div className="product-info">
                                                <div className="product-name">{getLocalizedTitle(post)}</div>
                                                <div className="product-id">{post.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td data-label={t('admin.blog.table.author')}>{post.author}</td>
                                    <td data-label={t('admin.blog.table.published')}>{post.published_at ? formatDate(post.published_at) : '—'}</td>
                                    <td data-label={t('admin.blog.table.status')}>
                                        <span className={`status-badge ${post.is_published ? 'status-active' : 'status-draft'}`}>
                                            {post.is_published ? t('admin.blog.status.published') : t('admin.blog.status.draft')}
                                        </span>
                                    </td>
                                    <td data-label={t('admin.blog.table.actions')}>
                                        <div className="action-buttons">
                                            <Link to={`/admin/dashboard/blog/${post.id}/edit`} className="button button-small button-secondary">
                                                {t('common.edit')}
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteClick(post.id)}
                                                className="button button-small button-danger"
                                            >
                                                {t('common.delete')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    page={page}
                    hasMore={hasMore}
                    totalPages={totalPages}
                    onPrevPage={() => setPage(page - 1)}
                    onNextPage={() => setPage(page + 1)}
                />
                </>
            )}
            {confirmDeleteId && (
                <ConfirmModal
                    title={t('confirm.delete.title')}
                    message={t('confirm.delete.blogMessage')}
                    confirmLabel={t('confirm.delete.confirm')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDeleteId(null)}
                    variant="danger"
                />
            )}
        </div>
    );
}

export default AdminBlog;
