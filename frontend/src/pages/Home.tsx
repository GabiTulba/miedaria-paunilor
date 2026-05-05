import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizedProductWithImage, LocalizedBlogPost } from '../types';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import { LocalizedLink } from '../components/LocalizedLink';
import { getOrigin } from '../lib/origin';
import { buildOrganizationLd, buildLocalBusinessLd } from '../lib/structuredData';
import './Home.css';

function Home() {
    const [featuredProducts, setFeaturedProducts] = useState<LocalizedProductWithImage[]>([]);
    const [latestBlogPosts, setLatestBlogPosts] = useState<LocalizedBlogPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { t, i18n } = useTranslation();
    const formatDate = useFormattedDate();

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const productsData = await api.getProducts({
                    order_by: 'bottling_date',
                    order_direction: 'desc',
                    in_stock: true,
                }, controller.signal);
                setFeaturedProducts((productsData.items ?? []).slice(0, 3));

                const blogData = await api.getBlogPosts(undefined, undefined, controller.signal);
                setLatestBlogPosts((blogData.items ?? []).slice(0, 3));
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.error("Failed to fetch data:", error);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };
        fetchData();
        return () => { controller.abort(); };
    }, [i18n.language]);

    const origin = getOrigin();

    return (
        <div className="home-page">
            <SEO
                title={t('seo.pageTitles.home')}
                description={t('seo.pageDescriptions.home')}
                structuredData={[buildOrganizationLd(origin), buildLocalBusinessLd(origin)]}
            />
            <section className="hero-section">
                <div className="logo-container">
                    <img src="/logo.svg" alt="Miedăria Păunilor" className="hero-logo" width={1024} height={1536} />
                </div>
                <div className="hero-content">
                    <h1>{t('home.heroTitle')}</h1>
                    <p>{t('home.heroDescription')}</p>
                    <LocalizedLink to="/shop" className="button">{t('home.exploreCollection')}</LocalizedLink>
                </div>
            </section>

            {(isLoading || featuredProducts.length > 0) && (
                <section className="featured-products">
                    <div className="section-content-container">
                        <div className="featured-content">
                            <h2>{t('home.featuredProducts')}</h2>
                             <div className="product-grid">
                             {isLoading ? (
                                 [1, 2, 3].map(i => (
                                     <ProductCard key={i} renderSkeleton />
                                 ))
                             ) : (
                                 featuredProducts.map(productWithImage => (
                                     <ProductCard
                                         key={productWithImage.product.product_id}
                                         productWithImage={productWithImage}
                                     />
                                 ))
                             )}
                         </div>
                        </div>
                    </div>
                </section>
            )}

            {(isLoading || latestBlogPosts.length > 0) && (
                <section className="blog-teaser">
                    <div className="section-content-container">
                        <div className="teaser-content">
                            <h2>{t('home.latestBlogPosts')}</h2>
                            <div className="blog-grid">
                                {isLoading ? (
                                    [1, 2, 3].map(i => (
                                        <article key={i} className="blog-post-card">
                                            <div className="blog-post-header">
                                                <h3 className="blog-post-title">
                                                    <span className="skeleton" style={{ display: 'block', height: '1.2em', width: '85%' }} />
                                                </h3>
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
                                    ))
                                ) : (
                                    latestBlogPosts.map(post => (
                                        <article key={post.id} className="blog-post-card">
                                            <div className="blog-post-header">
                                                <h3 className="blog-post-title">
                                                    <LocalizedLink to={`/blog/${post.slug}`}>{post.title}</LocalizedLink>
                                                </h3>
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
                                                <p>{post.excerpt}</p>
                                            </div>
                                            <div className="blog-post-actions">
                                                <LocalizedLink to={`/blog/${post.slug}`} className="read-more-btn">
                                                    {t('blog.readMore')}
                                                </LocalizedLink>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                            <LocalizedLink to="/blog" className="button button-secondary">{t('home.viewAllPosts')}</LocalizedLink>
                        </div>
                    </div>
                </section>
            )}

            <section className="about-teaser">
                <div className="section-content-container">
                    <div className="teaser-content">
                        <h2>{t('home.ourStory')}</h2>
                        <p>{t('home.ourStoryDescription')}</p>
                        <LocalizedLink to="/about-us" className="button button-secondary">{t('home.readMore')}</LocalizedLink>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;