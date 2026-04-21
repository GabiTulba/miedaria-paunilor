import { useEffect, useState, useContext, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '../../types';
import { api } from '../../lib/api';
import { useFormattedDate } from '../../hooks/useFormattedDate';
import { useLanguage } from '../../hooks/useLanguage';
import { AuthContext } from '../../context/AuthContext';
import Pagination from '../../components/Pagination';
import './Admin.css';

const ADMIN_BLOG_PER_PAGE = 20;

function AdminBlog() {
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const { t } = useTranslation();
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
                const posts = await api.getBlogPostsAdmin(token, page, ADMIN_BLOG_PER_PAGE, ADMIN_BLOG_PER_PAGE + 1, controller.signal);
                setHasMore(posts.length > ADMIN_BLOG_PER_PAGE);
                setBlogPosts(posts.slice(0, ADMIN_BLOG_PER_PAGE));
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

    const handleDelete = async (id: string) => {
        if (!token || !window.confirm(t('admin.products.deleteConfirm'))) return;

        try {
            await api.deleteBlogPost(id, token);
            if (blogPosts.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                setFetchTrigger(n => n + 1);
            }
        } catch (err) {
            console.error("Failed to delete blog post:", err);
            alert(t('common.error'));
        }
    };

    if (error) {
        return (
            <div className="admin-content">
                <div className="error-message">
                    {error}
                    <button onClick={() => window.location.reload()} className="retry-button">
                        {t('admin.products.retry')}
                    </button>
                </div>
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

            {blogPosts.length === 0 && page === 1 && !loading ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
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
                                    <td>{post.author}</td>
                                    <td>{formatDate(post.published_at)}</td>
                                    <td>
                                        <span className={`status-badge ${post.is_published ? 'status-active' : 'status-draft'}`}>
                                            {post.is_published ? t('admin.blog.status.published') : t('admin.blog.status.draft')}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Link to={`/admin/dashboard/blog/${post.id}/edit`} className="button button-small button-secondary">
                                                {t('common.edit')}
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(post.id)}
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
                    onPrevPage={() => setPage(page - 1)}
                    onNextPage={() => setPage(page + 1)}
                />
                </>
            )}
        </div>
    );
}

export default AdminBlog;
