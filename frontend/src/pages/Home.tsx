import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductWithImage, BlogPost } from '../types';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import './Home.css';

function Home() {
    const [featuredProducts, setFeaturedProducts] = useState<ProductWithImage[]>([]);
    const [latestBlogPosts, setLatestBlogPosts] = useState<BlogPost[]>([]);
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch products sorted by bottling date (newest first)
                // Using the same approach as useFetchProducts hook
                const params = new URLSearchParams();
                params.append('order_by', 'bottling_date');
                params.append('order_direction', 'desc');
                const queryString = params.toString();
                const url = `/products${queryString ? `?${queryString}` : ''}`;
                const products = await api.get(url);
                setFeaturedProducts(products.slice(0, 3));
                
                const blogPosts = await api.getBlogPosts();
                // Take the first 3 posts (newest first from backend)
                setLatestBlogPosts(blogPosts.slice(0, 3));
            } catch (error) {
                console.error("Failed to fetch data:", error);
            }
        };
        fetchData();
    }, []);

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

            <section className="featured-products">
                <div className="section-content-container">
                    <div className="featured-content">
                        <h2>{t('home.featuredProducts')}</h2>
                         <div className="product-grid">
                         {featuredProducts.map(productWithImage => (
                             <ProductCard 
                                 key={productWithImage.product.product_id} 
                                 productWithImage={productWithImage} 
                             />
                         ))}
                     </div>
                    </div>
                </div>
            </section>

            <section className="blog-teaser">
                <div className="section-content-container">
                    <div className="teaser-content">
                        <h2>{t('home.latestBlogPosts')}</h2>
                        <p>{t('home.readOurBlog')}</p>
                        <div className="blog-grid">
                            {latestBlogPosts.map(post => {
                                const isRomanian = i18n.language === 'ro';
                                const title = isRomanian ? post.title_ro : post.title;
                                const excerpt = isRomanian ? post.excerpt_ro : post.excerpt;
                                
                                return (
                                    <article key={post.id} className="blog-post-card">
                                        <div className="blog-post-header">
                                            <h3 className="blog-post-title">
                                                <Link to={`/blog/${post.blog_id}`}>{title}</Link>
                                            </h3>
                                            <div className="blog-post-meta">
                                                <span className="blog-post-date">
                                                    {new Date(post.published_at).toLocaleDateString(i18n.language, {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                                <span className="blog-post-author">
                                                    {t('blog.byAuthor', { author: post.author })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="blog-post-excerpt">
                                            <p>{excerpt}</p>
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
                        <Link to="/blog" className="button button-secondary">{t('home.viewAllPosts')}</Link>
                    </div>
                </div>
            </section>

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