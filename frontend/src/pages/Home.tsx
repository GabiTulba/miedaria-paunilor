import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import { useFetch } from '../hooks/useFetch';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import { LocalizedLink } from '../components/LocalizedLink';
import { getOrigin } from '../lib/origin';
import { buildOrganizationLd, buildLocalBusinessLd } from '../lib/structuredData';
import { Skeleton } from '../components/Skeleton';
import './Home.css';

function Home() {
    const { t, i18n } = useTranslation();
    const formatDate = useFormattedDate();

    const { data, loading: isLoading } = useFetch(
        async signal => {
            const [productsData, blogData] = await Promise.all([
                api.getProducts({ order_by: 'bottling_date', order_direction: 'desc', in_stock: true }, signal),
                api.getBlogPosts(undefined, undefined, signal),
            ]);
            return {
                featured: (productsData.items ?? []).slice(0, 3),
                blog: (blogData.items ?? []).slice(0, 3),
            };
        },
        [i18n.language],
    );
    const featuredProducts = data?.featured ?? [];
    const latestBlogPosts = data?.blog ?? [];

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
                                                    <Skeleton block h="1.2em" w="85%" />
                                                </h3>
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