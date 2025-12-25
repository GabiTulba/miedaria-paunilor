import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '../types';
import { api } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Blog.css';

function Blog() {
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const fetchBlogPosts = async () => {
            try {
                setLoading(true);
                const posts = await api.getBlogPosts();
                setBlogPosts(posts);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch blog posts:", err);
                setError(t('blog.fetchError'));
            } finally {
                setLoading(false);
            }
        };
        fetchBlogPosts();
    }, [t]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getLocalizedContent = (post: BlogPost) => {
        const isRomanian = i18n.language === 'ro';
        return {
            title: isRomanian ? post.title_ro : post.title,
            excerpt: isRomanian ? post.excerpt_ro : post.excerpt,
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

    if (error) {
        return (
            <div className="blog-page">
                <div className="blog-container">
                    <div className="error-message">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="blog-page">
            <div className="blog-container">
                <header className="blog-header">
                    <h1>{t('blog.title')}</h1>
                    <p>{t('blog.description')}</p>
                </header>

                {blogPosts.length === 0 ? (
                    <div className="no-posts">
                        <p>{t('blog.noPosts')}</p>
                    </div>
                ) : (
                    <div className="blog-posts">
                        {blogPosts.map((post) => {
                            const localized = getLocalizedContent(post);
                            return (
                                <article key={post.id} className="blog-post-card">
                                    <div className="blog-post-header">
                                        <h2 className="blog-post-title">
                                            <Link to={`/blog/${post.blog_id}`}>{localized.title}</Link>
                                        </h2>
                                        <div className="blog-post-meta">
                                            <span className="blog-post-date">
                                                {formatDate(post.published_at)}
                                            </span>
                                            <span className="blog-post-author">
                                                {t('blog.byAuthor', { author: post.author })}
                                            </span>
                                        </div>
                                    </div>
                                     <div className="blog-post-excerpt">
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
                                                 // Handle table components for excerpts too
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
                                             {localized.excerpt}
                                         </ReactMarkdown>
                                     </div>
                                    <div className="blog-post-actions">
                                        <Link to={`/blog/${post.blog_id}`} className="read-more-btn">
                                            {t('blog.readMore')}
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Blog;