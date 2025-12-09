import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ProductWithImage } from '../types'; // Import ProductWithImage
import { api } from '../lib/api';
import { getMeadTypeLabel, getSweetnessTypeLabel } from '../enums';
import './Home.css';

function Home() {
    const [featuredProducts, setFeaturedProducts] = useState<ProductWithImage[]>([]); // Change type here

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
                    {featuredProducts.map(productWithImage => ( // Iterate over ProductWithImage
                        <div key={productWithImage.product.product_id} className="product-card">
                            <Link to={`/shop/${productWithImage.product.product_id}`}>
                                <div className="product-card-main">
                                    <div className="product-card-image">
                                        {productWithImage.image ? (
                                            <img 
                                                src={`/images/${productWithImage.image.id}`} 
                                                alt={productWithImage.product.product_name} 
                                                className="product-image" 
                                            />
                                        ) : (
                                            <div className="placeholder-image">No Image</div>
                                        )}
                                    </div>
                                    <div className="product-card-content">
                                        <h3>{productWithImage.product.product_name}</h3>
                                        <div className="product-details">
                                            <span className="mead-type">{getMeadTypeLabel(productWithImage.product.product_type)}</span>
                                            <span className="separator">|</span>
                                            <span className="sweetness">{getSweetnessTypeLabel(productWithImage.product.sweetness)}</span>
                                            <span className="separator">|</span>
                                            <span className="abv">{productWithImage.product.abv}% ABV</span>
                                            <span className="separator">|</span>
                                            <span className="volume">{productWithImage.product.bottle_size}ml</span>
                                        </div>
                                        <p className="price">{productWithImage.product.price} €</p>
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