import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ApiError } from '../types';
import { useFormattedDate } from '../hooks/useFormattedDate';
import { useFetch } from '../hooks/useFetch';
import ErrorDisplay from '../components/ErrorDisplay';
import Breadcrumb from '../components/Breadcrumb';
import SEO from '../components/SEO';
import { useLanguage } from '../hooks/useLanguage';
import { getOrigin } from '../lib/origin';
import { buildArticleLd, buildBreadcrumbLd } from '../lib/structuredData';
import { stripMarkdown, clamp } from '../lib/text';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BLOG_MARKDOWN_COMPONENTS } from '../lib/markdownComponents';
import { Skeleton } from '../components/Skeleton';
import './Blog.css';

function BlogPostDetail() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const lang = useLanguage();
    const formatDateOptions = useMemo(() => ({
        year: 'numeric' as const,
        month: 'long' as const,
        day: 'numeric' as const,
        hour: '2-digit' as const,
        minute: '2-digit' as const,
    }), []);
    const formatDate = useFormattedDate(formatDateOptions);

    const { data: blogPost, loading, error, refetch } = useFetch(
        signal => slug ? api.getBlogPostBySlug(slug, signal) : Promise.reject(new Error(t('blog.invalidSlug'))),
        [slug, i18n.language],
    );
    const is404 = (error as ApiError | null)?.response?.status === 404;
    const errorMessage = !slug
        ? t('blog.invalidSlug')
        : error
            ? (is404 ? t('blog.notFound') : t('blog.fetchError'))
            : null;

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
                            <Skeleton block h="1.5em" w="80%" />
                        </h1>
                        <div className="blog-post-meta">
                            <Skeleton inline h="0.9em" w="25%" />
                            <span className="blog-post-author">
                                <Skeleton inline h="0.9em" w="35%" />
                            </span>
                        </div>
                    </header>
                    <div className="blog-post-content">
                        <Skeleton block h="1em" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton block h="1em" w="95%" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton block h="1em" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton block h="1em" w="80%" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton block h="1em" style={{ marginTop: '1rem', marginBottom: '0.5rem' }} />
                        <Skeleton block h="1em" w="85%" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton block h="1em" w="65%" />
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
                        error={errorMessage || t('blog.notFound')}
                        onRetry={!is404 && error ? refetch : undefined}
                        retryLabel={t('common.retry')}
                    />
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>{backLink}</div>
                </main>
            </div>
        );
    }

    const origin = getOrigin();
    const pagePath = `/${lang}/blog/${blogPost.slug}`;
    const pageUrl = `${origin}${pagePath}`;
    const seoDescription = clamp(stripMarkdown(blogPost.excerpt), 160);
    const articleLd = buildArticleLd({
        post: blogPost,
        origin,
        pageUrl,
    });
    const breadcrumbLd = buildBreadcrumbLd(
        [
            { name: t('navigation.home'), url: `/${lang}` },
            { name: t('blog.title'), url: `/${lang}/blog` },
            { name: blogPost.title, url: pagePath },
        ],
        origin
    );

    return (
        <div className="blog-page">
            <SEO
                title={blogPost.title}
                description={seoDescription}
                type="article"
                structuredData={[articleLd, breadcrumbLd]}
            />
            <Breadcrumb items={[
                { label: t('navigation.home'), to: '/' },
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
                        components={BLOG_MARKDOWN_COMPONENTS}
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
