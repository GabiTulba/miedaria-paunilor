import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '../types';
import { api } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Blog.css';

function BlogPostDetail() {
    const { blog_id } = useParams<{ blog_id: string }>();
    const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const fetchBlogPost = async () => {
            if (!blog_id) {
                setError(t('blog.invalidBlogId'));
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const post = await api.getBlogPostByBlogId(blog_id);
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
    }, [blog_id, t]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getLocalizedContent = (post: BlogPost) => {
        const isRomanian = i18n.language === 'ro';
        return {
            title: isRomanian ? post.title_ro : post.title,
            content: isRomanian ? post.content_markdown_ro : post.content_markdown
        };
    };

    if (loading) {
        return (
            <div className="blog-page">
                <div className="blog-container">
                    <div className="loading-spinner">{t('common.loading')}</div>
                </div>
            </div>
        );
    }

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

    const localized = getLocalizedContent(blogPost);

    return (
        <div className="blog-page">
            <div className="blog-container blog-post-detail">
                <article className="blog-post-card">
                    <header className="blog-post-header">
                        <h1 className="blog-post-title">{localized.title}</h1>
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
                             {localized.content}
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