import { Outlet, useLocation } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from './context/CartContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import LangGuard from './components/LangGuard';
import { LocalizedLink, LocalizedNavLink } from './components/LocalizedLink';
import './App.css';
import './components/LanguageSwitcher.css';

function App() {
  const { itemCount } = useContext(CartContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (!isMobile) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstLink = navRef.current?.querySelector<HTMLElement>('a');
    firstLink?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        navRef.current &&
        !navRef.current.contains(target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <a href="#main-content" className="skip-link">{t('navigation.skipToContent')}</a>
      <header className="header">
        <div className="container">
          <LocalizedLink to="/" className="logo">
            <img src="/logo.svg" alt="Miedăria Păunilor" className="logo-image" width={1024} height={1536} />
            Miedăria Păunilor
          </LocalizedLink>
          <nav
            id="main-navigation"
            ref={navRef}
            className={`main-nav ${isMobileMenuOpen ? 'active' : ''}`}
            aria-label={t('navigation.main')}
          >
            <LocalizedNavLink to="/" end>{t('navigation.home')}</LocalizedNavLink>
            <LocalizedNavLink to="/shop">{t('navigation.shop')}</LocalizedNavLink>
            <LocalizedNavLink to="/blog">{t('blog.title')}</LocalizedNavLink>
            <LocalizedNavLink to="/about-us">{t('navigation.aboutUs')}</LocalizedNavLink>
            <LocalizedNavLink to="/contact">{t('navigation.contact')}</LocalizedNavLink>
            <LocalizedNavLink to="/cart">{t('navigation.cart')} {itemCount > 0 && `(${itemCount})`}</LocalizedNavLink>
            <ThemeToggle />
            <LanguageSwitcher />
          </nav>
          <button
            ref={hamburgerRef}
            type="button"
            className="hamburger"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-controls="main-navigation"
            aria-label={t('navigation.toggleMenu')}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>
      </header>
      <ToastContainer />
      <main id="main-content">
        <ErrorBoundary>
          <LangGuard>
            <Outlet />
          </LangGuard>
        </ErrorBoundary>
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
