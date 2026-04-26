import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizedProductWithImage, LocalizedBlogPost } from '../types';
import { api } from '../lib/api';
import { useFormattedDate } from '../hooks/useFormattedDate';
import ProductCard from '../components/ProductCard';
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
                const params = new URLSearchParams();
                params.append('order_by', 'bottling_date');
                params.append('order_direction', 'desc');
                params.append('in_stock', 'true');
                const queryString = params.toString();
                const url = `/products${queryString ? `?${queryString}` : ''}`;
                const products = await api.get(url, { signal: controller.signal });
                setFeaturedProducts(products.slice(0, 3));

                const blogPosts = await api.getBlogPosts(undefined, undefined, undefined, controller.signal);
                setLatestBlogPosts(blogPosts.slice(0, 3));
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

    return (
        <div className="home-page">
            <section className="hero-section">
                <div className="logo-container">
                    <img src="/logo.svg" alt="Miedăria Păunilor" className="hero-logo" />
                </div>
                <div className="hero-content">
                    <h1>{t('home.heroTitle')}</h1>
                    <p>{t('home.heroDescription')}</p>
                    <Link to="/shop" className="button">{t('home.exploreCollection')}</Link>
                </div>
            </section>

            {(isLoading || featuredProducts.length > 0) && (
                <section className="featured-products">
                    <div className="section-content-container">
                        <div className="featured-content">
                            <h2>{t('home.featuredProducts')}</h2>
                             <div className="product-grid">
                             {isLoading ? (
                                 <div className="loader">{t('common.loading')}</div>
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
                                    <div className="loader">{t('common.loading')}</div>
                                ) : (
                                    latestBlogPosts.map(post => (
                                        <article key={post.id} className="blog-post-card">
                                            <div className="blog-post-header">
                                                <h3 className="blog-post-title">
                                                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
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
                                                <Link to={`/blog/${post.slug}`} className="read-more-btn">
                                                    {t('blog.readMore')}
                                                </Link>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                            <Link to="/blog" className="button button-secondary">{t('home.viewAllPosts')}</Link>
                        </div>
                    </div>
                </section>
            )}

            <section className="about-teaser">
                <div className="section-content-container">
                    <div className="teaser-content">
                        <h2>{t('home.ourStory')}</h2>
                        <p>{t('home.ourStoryDescription')}</p>
                        <Link to="/about-us" className="button button-secondary">{t('home.readMore')}</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;