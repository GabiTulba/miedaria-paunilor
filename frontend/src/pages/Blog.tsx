import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocalizedBlogPost } from '../types';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import Pagination from '../components/Pagination';
import ErrorDisplay from '../components/ErrorDisplay';
import SEO from '../components/SEO';
import { LocalizedLink } from '../components/LocalizedLink';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BLOG_MARKDOWN_COMPONENTS } from '../lib/markdownComponents';
import './Blog.css';

const BLOG_PER_PAGE = 10;

function Blog() {
    const [blogPosts, setBlogPosts] = useState<LocalizedBlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const { t, i18n } = useTranslation();
    const formatDate = useFormattedDate();

    useEffect(() => {
        const controller = new AbortController();
        const fetchBlogPosts = async () => {
            try {
                setLoading(true);
                const data = await api.getBlogPosts(page, BLOG_PER_PAGE, controller.signal);
                setTotalPages(data.total_pages ?? 1);
                setHasMore(page < (data.total_pages ?? 1));
                setBlogPosts(data.items ?? []);
                setError(null);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error("Failed to fetch blog posts:", err);
                setError(t('blog.fetchError'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        fetchBlogPosts();
        return () => { controller.abort(); };
    }, [i18n.language, page, fetchTrigger]);

    if (error) {
        return (
            <div className="blog-page">
                <ErrorDisplay
                    error={error}
                    onRetry={() => setFetchTrigger(n => n + 1)}
                    retryLabel={t('common.retry')}
                />
            </div>
        );
    }

    return (
        <div className="blog-page">
            <SEO title={t('seo.pageTitles.blog')} description={t('seo.pageDescriptions.blog')} />
            <header className="blog-header">
                    <h1>{t('blog.title')}</h1>
                    <p>{t('blog.description')}</p>
                </header>

                <div className="blog-content">
                {loading ? (
                    <div className="blog-posts">
                        {[1, 2, 3].map(i => (
                            <article key={i} className="blog-post-card">
                                <div className="blog-post-header">
                                    <h2 className="blog-post-title">
                                        <span className="skeleton" style={{ display: 'block', height: '1.3em', width: '85%' }} />
                                    </h2>
                                    <div className="blog-post-meta">
                                        <span className="skeleton" style={{ display: 'inline-block', height: '0.85em', width: '25%' }} />
                                        <span>
                                            <span className="skeleton" style={{ display: 'inline-block', height: '0.85em', width: '40%' }} />
                                        </span>
                                    </div>
                                </div>
                                <div className="blog-post-excerpt">
                                    <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem' }} />
                                    <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem', width: '92%' }} />
                                    <span className="skeleton" style={{ display: 'block', height: '1em', width: '70%' }} />
                                </div>
                                <div className="blog-post-actions">
                                    <span className="skeleton" style={{ display: 'inline-block', height: '1em', width: '90px' }} />
                                </div>
                            </article>
                        ))}
                    </div>
                ) : blogPosts.length === 0 && !loading ? (
                    <div className="no-posts">
                        <p>{t('blog.noPosts')}</p>
                    </div>
                ) : (
                    <div className="blog-posts">
                        {blogPosts.map((post) => (
                                <article key={post.id} className="blog-post-card">
                                    <div className="blog-post-header">
                                        <h2 className="blog-post-title">
                                            <LocalizedLink to={`/blog/${post.slug}`}>{post.title}</LocalizedLink>
                                        </h2>
                                        <div className="blog-post-meta">
                                            <span className="blog-post-date">
                                                {post.published_at ? formatDate(post.published_at) : ''}
                                            </span>
                                            <span className="blog-post-author">
                                                {t('blog.byAuthor', { author: post.author })}
                                            </span>
                                        </div>
                                    </div>
                                     <div className="blog-post-excerpt">
                                         <ReactMarkdown
                                             remarkPlugins={[remarkGfm]}
                                             components={BLOG_MARKDOWN_COMPONENTS}
                                         >
                                             {post.excerpt}
                                         </ReactMarkdown>
                                     </div>
                                    <div className="blog-post-actions">
                                        <LocalizedLink to={`/blog/${post.slug}`} className="read-more-btn">
                                            {t('blog.readMore')}
                                        </LocalizedLink>
                                    </div>
                                </article>
                            ))}
                    </div>
                )}
                <Pagination
                    page={page}
                    hasMore={hasMore}
                    totalPages={totalPages}
                    onPrevPage={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onNextPage={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
                </div>
        </div>
    );
}

export default Blog;