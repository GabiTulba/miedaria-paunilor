import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductWithImage } from '../types';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import './Home.css';

function Home() {
    const [featuredProducts, setFeaturedProducts] = useState<ProductWithImage[]>([]);
    const { t } = useTranslation();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const products = await api.getProducts();
                setFeaturedProducts(products.slice(0, 3));
            } catch (error) {
                console.error("Failed to fetch products:", error);
            }
        };
        fetchProducts();
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
                    <h2 className="section-title">{t('home.featuredProducts')}</h2>
                     <div className="product-grid">
                     {featuredProducts.map(productWithImage => (
                         <ProductCard 
                             key={productWithImage.product.product_id} 
                             productWithImage={productWithImage} 
                         />
                     ))}
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