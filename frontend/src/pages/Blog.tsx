import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import { useFetch } from '../hooks/useFetch';
import { usePageParam } from '../hooks/usePageParam';
import Pagination from '../components/Pagination';
import ErrorDisplay from '../components/ErrorDisplay';
import SEO from '../components/SEO';
import { LocalizedLink } from '../components/LocalizedLink';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BLOG_MARKDOWN_COMPONENTS } from '../lib/markdownComponents';
import { Skeleton } from '../components/Skeleton';
import './Blog.css';

const BLOG_PER_PAGE = 10;

function Blog() {
    const [page, setPage] = usePageParam();
    const { t, i18n } = useTranslation();
    const formatDate = useFormattedDate();

    const { data, loading, error, refetch } = useFetch(
        signal => api.getBlogPosts(page, BLOG_PER_PAGE, signal),
        [i18n.language, page],
    );
    const blogPosts = data?.items ?? [];
    const totalPages = data?.total_pages ?? 1;
    const hasMore = page < totalPages;

    if (error) {
        return (
            <div className="blog-page">
                <ErrorDisplay
                    error={t('blog.fetchError')}
                    onRetry={refetch}
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
                                        <Skeleton block h="1.3em" w="85%" />
                                    </h2>
                                    <div className="blog-post-meta">
                                        <Skeleton inline h="0.85em" w="25%" />
                                        <span>
                                            <Skeleton inline h="0.85em" w="40%" />
                                        </span>
                                    </div>
                                </div>
                                <div className="blog-post-excerpt">
                                    <Skeleton block h="1em" style={{ marginBottom: '0.5rem' }} />
                                    <Skeleton block h="1em" w="92%" style={{ marginBottom: '0.5rem' }} />
                                    <Skeleton block h="1em" w="70%" />
                                </div>
                                <div className="blog-post-actions">
                                    <Skeleton inline h="1em" w="90px" />
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
                    onPrevPage={() => setPage(page - 1)}
                    onNextPage={() => setPage(page + 1)}
                    scrollOnChange
                />
                </div>
        </div>
    );
}

export default Blog;