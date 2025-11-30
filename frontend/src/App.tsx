import { Outlet, Link, NavLink } from "react-router-dom";
import { useContext, useState } from 'react';
import { CartContext } from './context/CartContext';
import './App.css';

function App() {
  const { itemCount } = useContext(CartContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">Miedăria Păunilor</Link>
          <nav className={`main-nav ${isMobileMenuOpen ? 'active' : ''}`}>
            <NavLink to="/home" onClick={toggleMobileMenu}>Home</NavLink>
            <NavLink to="/shop" onClick={toggleMobileMenu}>Shop</NavLink>
            <NavLink to="/about-us" onClick={toggleMobileMenu}>About Us</NavLink>
            <NavLink to="/contact" onClick={toggleMobileMenu}>Contact</NavLink>
            <NavLink to="/cart" onClick={toggleMobileMenu}>Cart {itemCount > 0 && `(${itemCount})`}</NavLink>

          </nav>
          <button className="hamburger" onClick={toggleMobileMenu}>
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <p>&copy; 2025 Miedăria Păunilor. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

export default App;