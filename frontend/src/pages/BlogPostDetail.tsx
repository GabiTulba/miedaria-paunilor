import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocalizedBlogPost } from '../types';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Blog.css';

function BlogPostDetail() {
    const { slug } = useParams<{ slug: string }>();
    const [blogPost, setBlogPost] = useState<LocalizedBlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();
    const formatDateOptions = useMemo(() => ({
        year: 'numeric' as const,
        month: 'long' as const,
        day: 'numeric' as const,
        hour: '2-digit' as const,
        minute: '2-digit' as const,
    }), []);
    const formatDate = useFormattedDate(formatDateOptions);

    useEffect(() => {
        const fetchBlogPost = async () => {
            if (!slug) {
                setError(t('blog.invalidSlug'));
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const post = await api.getBlogPostBySlug(slug);
                setBlogPost(post);
                setError(null);
            } catch (err: any) {
                console.error("Failed to fetch blog post:", err);
                if (err.response?.status === 404) {
                    setError(t('blog.notFound'));
                } else {
                    setError(t('blog.fetchError'));
                }
            } finally {
                setLoading(false);
            }
        };
        fetchBlogPost();
    }, [slug, t]);

    if (loading) return null;

    if (error || !blogPost) {
        return (
            <div className="blog-page">
                <div className="blog-container">
                    <div className="error-message">{error}</div>
                    <Link to="/blog" className="back-to-blog">
                        {t('blog.backToBlog')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="blog-page">
            <div className="blog-container blog-post-detail">
                <article className="blog-post-card">
                    <header className="blog-post-header">
                        <h1 className="blog-post-title">{blogPost.title}</h1>
                        <div className="blog-post-meta">
                            <span className="blog-post-date">
                                {formatDate(blogPost.published_at)}
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
                                     // Extract size from alt text like "Alt text {width=200}"
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
                                 // Handle table components
                                 table: ({node, children, ...props}) => (
                                     <table className="blog-table" {...props}>
                                         {children}
                                     </table>
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
                        <Link to="/blog" className="back-to-blog">
                            {t('blog.backToBlog')}
                        </Link>
                    </div>
                </article>
            </div>
        </div>
    );
}

export default BlogPostDetail;