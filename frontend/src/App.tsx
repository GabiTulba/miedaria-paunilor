import { Outlet, Link, NavLink } from "react-router-dom";
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from './context/CartContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import './App.css';
import './components/LanguageSwitcher.css';

function App() {
  const { itemCount } = useContext(CartContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <img src="/logo.svg" alt="Miedăria Păunilor" className="logo-image" />
            Miedăria Păunilor
          </Link>
          <nav className={`main-nav ${isMobileMenuOpen ? 'active' : ''}`}>
            <NavLink to="/home" onClick={toggleMobileMenu}>{t('navigation.home')}</NavLink>
            <NavLink to="/shop" onClick={toggleMobileMenu}>{t('navigation.shop')}</NavLink>
            <NavLink to="/blog" onClick={toggleMobileMenu}>{t('blog.title')}</NavLink>
            <NavLink to="/about-us" onClick={toggleMobileMenu}>{t('navigation.aboutUs')}</NavLink>
            <NavLink to="/contact" onClick={toggleMobileMenu}>{t('navigation.contact')}</NavLink>
            <NavLink to="/cart" onClick={toggleMobileMenu}>{t('navigation.cart')} {itemCount > 0 && `(${itemCount})`}</NavLink>
            <LanguageSwitcher />
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
          <p>{t('footer.copyright', { year: currentYear })}</p>
        </div>
      </footer>
    </>
  );
}

export default App;