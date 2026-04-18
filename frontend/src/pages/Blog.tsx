import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LocalizedBlogPost } from '../types';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import Pagination from '../components/Pagination';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Blog.css';

const BLOG_PER_PAGE = 10;

function Blog() {
    const [blogPosts, setBlogPosts] = useState<LocalizedBlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const setPage = (p: number) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n; });
    const { t, i18n } = useTranslation();
    const formatDate = useFormattedDate();

    useEffect(() => {
        const fetchBlogPosts = async () => {
            try {
                setLoading(true);
                const posts = await api.getBlogPosts(page, BLOG_PER_PAGE, BLOG_PER_PAGE + 1);
                setHasMore(posts.length > BLOG_PER_PAGE);
                setBlogPosts(posts.slice(0, BLOG_PER_PAGE));
                setError(null);
            } catch (err) {
                console.error("Failed to fetch blog posts:", err);
                setError(t('blog.fetchError'));
            } finally {
                setLoading(false);
            }
        };
        fetchBlogPosts();
    }, [i18n.language, page]);

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

                <div className="blog-content">
                {blogPosts.length === 0 && !loading ? (
                    <div className="no-posts">
                        <p>{t('blog.noPosts')}</p>
                    </div>
                ) : (
                    <div className="blog-posts">
                        {blogPosts.map((post) => (
                                <article key={post.id} className="blog-post-card">
                                    <div className="blog-post-header">
                                        <h2 className="blog-post-title">
                                            <Link to={`/blog/${post.slug}`}>{post.title}</Link>
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
                                             {post.excerpt}
                                         </ReactMarkdown>
                                     </div>
                                    <div className="blog-post-actions">
                                        <Link to={`/blog/${post.slug}`} className="read-more-btn">
                                            {t('blog.readMore')}
                                        </Link>
                                    </div>
                                </article>
                            ))}
                    </div>
                )}
                <Pagination
                    page={page}
                    hasMore={hasMore}
                    onPrevPage={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onNextPage={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
                </div>
            </div>
        </div>
    );
}

export default Blog;