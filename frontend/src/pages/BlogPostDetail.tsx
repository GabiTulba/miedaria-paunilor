import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocalizedBlogPost } from '../types';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import ErrorDisplay from '../components/ErrorDisplay';
import Breadcrumb from '../components/Breadcrumb';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Blog.css';

function BlogPostDetail() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [blogPost, setBlogPost] = useState<LocalizedBlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [is404, setIs404] = useState(false);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const { t, i18n } = useTranslation();
    const formatDateOptions = useMemo(() => ({
        year: 'numeric' as const,
        month: 'long' as const,
        day: 'numeric' as const,
        hour: '2-digit' as const,
        minute: '2-digit' as const,
    }), []);
    const formatDate = useFormattedDate(formatDateOptions);

    useEffect(() => {
        const controller = new AbortController();
        const fetchBlogPost = async () => {
            if (!slug) {
                setError(t('blog.invalidSlug'));
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setIs404(false);
                const post = await api.getBlogPostBySlug(slug, controller.signal);
                setBlogPost(post);
            } catch (err: any) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error("Failed to fetch blog post:", err);
                if (err.response?.status === 404) {
                    setError(t('blog.notFound'));
                    setIs404(true);
                } else {
                    setError(t('blog.fetchError'));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        fetchBlogPost();
        return () => { controller.abort(); };
    }, [slug, i18n.language, fetchTrigger]);

    const backLink = (
        <button onClick={() => navigate(-1)} className="back-link">&larr; {t('blog.backToBlog')}</button>
    );

    if (loading) {
        return (
            <div className="blog-page">
                <div className="blog-back-link">{backLink}</div>
                <main className="blog-post-detail">
                    <header className="blog-post-header">
                        <h1 className="blog-post-title">
                            <span className="skeleton" style={{ display: 'block', height: '1.5em', width: '80%' }} />
                        </h1>
                        <div className="blog-post-meta">
                            <span className="skeleton" style={{ display: 'inline-block', height: '0.9em', width: '25%' }} />
                            <span className="blog-post-author">
                                <span className="skeleton" style={{ display: 'inline-block', height: '0.9em', width: '35%' }} />
                            </span>
                        </div>
                    </header>
                    <div className="blog-post-content">
                        <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem' }} />
                        <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem', width: '95%' }} />
                        <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem' }} />
                        <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem', width: '80%' }} />
                        <span className="skeleton" style={{ display: 'block', height: '1em', marginTop: '1rem', marginBottom: '0.5rem' }} />
                        <span className="skeleton" style={{ display: 'block', height: '1em', marginBottom: '0.5rem', width: '85%' }} />
                        <span className="skeleton" style={{ display: 'block', height: '1em', width: '65%' }} />
                    </div>
                </main>
            </div>
        );
    }

    if (error || !blogPost) {
        return (
            <div className="blog-page">
                <div className="blog-back-link">{backLink}</div>
                <main className="blog-post-detail">
                    <ErrorDisplay
                        error={error || t('blog.notFound')}
                        onRetry={!is404 && error ? () => setFetchTrigger(n => n + 1) : undefined}
                        retryLabel={t('common.retry')}
                    />
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>{backLink}</div>
                </main>
            </div>
        );
    }

    return (
        <div className="blog-page">
            <Breadcrumb items={[
                { label: t('navigation.home'), to: '/home' },
                { label: t('blog.title'), to: '/blog' },
                { label: blogPost.title },
            ]} />
            <div className="blog-back-link">{backLink}</div>
            <main className="blog-post-detail">
                <header className="blog-post-header">
                    <h1 className="blog-post-title">{blogPost.title}</h1>
                    <div className="blog-post-meta">
                        <span className="blog-post-date">
                            {blogPost.published_at ? formatDate(blogPost.published_at) : ''}
                        </span>
                        <span className="blog-post-author">
                            {t('blog.byAuthor', { author: blogPost.author })}
                        </span>
                        {blogPost.updated_at !== blogPost.published_at && (
                            <span className="blog-post-updated">
                                {t('blog.updatedOn', { date: formatDate(blogPost.updated_at) })}
                            </span>
                        )}
                    </div>
                </header>

                <div className="blog-post-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            img: ({node, ...props}) => {
                                const altText = props.alt || '';
                                const sizeMatch = altText.match(/\{width=(\d+)\}/);
                                const classNameMatch = altText.match(/\{class=(\w+)\}/);

                                let style: React.CSSProperties = {maxWidth: '100%', height: 'auto'};
                                let className = '';
                                let cleanAlt = altText;

                                if (sizeMatch) {
                                    style = {width: `${sizeMatch[1]}px`, height: 'auto', maxWidth: '100%'};
                                    cleanAlt = altText.replace(/\{width=\d+\}/, '').trim();
                                }

                                if (classNameMatch) {
                                    className = classNameMatch[1];
                                    cleanAlt = altText.replace(/\{class=\w+\}/, '').trim();
                                }

                                return <img {...props} alt={cleanAlt} style={style} className={className} />;
                            },
                            table: ({node, children, ...props}) => (
                                <div className="blog-table-wrapper" tabIndex={0} role="region" aria-label="table">
                                    <table className="blog-table" {...props}>
                                        {children}
                                    </table>
                                </div>
                            ),
                            thead: ({node, children, ...props}) => (
                                <thead {...props}>{children}</thead>
                            ),
                            tbody: ({node, children, ...props}) => (
                                <tbody {...props}>{children}</tbody>
                            ),
                            tr: ({node, children, ...props}) => (
                                <tr {...props}>{children}</tr>
                            ),
                            th: ({node, children, ...props}) => (
                                <th {...props}>{children}</th>
                            ),
                            td: ({node, children, ...props}) => (
                                <td {...props}>{children}</td>
                            )
                        }}
                    >
                        {blogPost.content_markdown}
                    </ReactMarkdown>
                </div>

                <div className="blog-post-actions">
                    {backLink}
                </div>
            </main>
        </div>
    );
}

export default BlogPostDetail;
