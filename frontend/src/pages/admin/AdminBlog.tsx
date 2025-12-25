import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '../../types';
import { api } from '../../lib/api';
import { AuthContext } from '../../context/AuthContext';
import './Admin.css';

function AdminBlog() {
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t, i18n } = useTranslation();
    const { token } = useContext(AuthContext);

    useEffect(() => {
        const fetchBlogPosts = async () => {
            if (!token) return;

            try {
                setLoading(true);
                const posts = await api.getBlogPostsAdmin(token);
                setBlogPosts(posts);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch blog posts:", err);
                setError(t('admin.products.error'));
            } finally {
                setLoading(false);
            }
        };
        fetchBlogPosts();
    }, [token, t]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getLocalizedTitle = (post: BlogPost) => {
        return i18n.language === 'ro' ? post.title_ro : post.title;
    };

    const handleDelete = async (id: string) => {
        if (!token || !window.confirm(t('admin.products.deleteConfirm'))) return;

        try {
            await api.deleteBlogPost(id, token);
            setBlogPosts(blogPosts.filter(post => post.id !== id));
        } catch (err) {
            console.error("Failed to delete blog post:", err);
            alert(t('common.error'));
        }
    };

    if (loading) {
        return (
            <div className="admin-content">
                <div className="loading-spinner">{t('common.loading')}</div>
            </div>
        );
    }

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
                    <Link to="/admin/dashboard/blog/create" className="primary-button">
                        <span className="button-icon">+</span>
                        {t('admin.blog.createNew')}
                    </Link>
                </div>
            </div>

            {blogPosts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <h3>{t('admin.blog.noPosts')}</h3>
                    <p>{t('admin.blog.noPostsDescription')}</p>
                    <Link to="/admin/dashboard/blog/create" className="primary-button">
                        {t('admin.blog.createFirst')}
                    </Link>
                </div>
            ) : (
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
                                                <div className="product-id">{post.blog_id}</div>
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
                                            <Link to={`/admin/dashboard/blog/${post.id}/edit`} className="action-button edit-button">
                                                {t('common.edit')}
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(post.id)}
                                                className="action-button delete-button"
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
            )}
        </div>
    );
}

export default AdminBlog;