import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Product } from '../types';
import { api } from '../lib/api';
import './Home.css';

function Home() {
    const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

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
                <div className="hero-content">
                    <h1>Artisanal Mead, Crafted with Passion</h1>
                    <p>Experience the ancient tradition of mead, reimagined for the modern palate. Made from 100% pure honey.</p>
                    <Link to="/shop" className="button">Explore Our Collection</Link>
                </div>
            </section>

            <section className="featured-products">
                <div className="section-content-container">
                    <h2 className="section-title">Featured Products</h2>
                    <div className="product-grid">
                    {featuredProducts.map(product => (
                        <div key={product.product_id} className="product-card">
                            <Link to={`/shop/${product.product_id}`}>
                                <div className="product-card-main">
                                    <div className="product-card-image">
                                    <img src={product.image_url} alt={product.product_name} className="product-image" />
                                    </div>
                                    <div className="product-card-content">
                                        <h3>{product.product_name}</h3>
                                        <p className="price">{product.price} €</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
                </div>
            </section>

            <section className="about-teaser">
                <div className="section-content-container">
                    <div className="teaser-content">
                        <h2>Our Story</h2>
                        <p>Miedăria Păunilor is born from a love for nature, tradition, and the golden nectar of bees. We are a family-run business dedicated to producing the finest mead.</p>
                        <Link to="/about-us" className="button button-secondary">Read More</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;