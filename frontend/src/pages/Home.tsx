import { Link } from 'react-router-dom';

function Home() {
    return (
        <div>
            <h2>Welcome to Miedăria Păunilor!</h2>
            <p>
                We are a small family-owned meadery dedicated to crafting high-quality mead from the finest local honey.
            </p>
            <div>
                <h3><Link to="/shop">Explore our Shop</Link></h3>
                <p>Discover our unique selection of meads.</p>
            </div>
            <div>
                <h3><Link to="/about-us">About Us</Link></h3>
                <p>Learn more about our story and passion for mead.</p>
            </div>
            <div>
                <h3><Link to="/contact">Contact Us</Link></h3>
                <p>Get in touch with us for any inquiries.</p>
            </div>
        </div>
    );
}

export default Home;