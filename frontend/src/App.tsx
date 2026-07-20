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
import { useFocusTrapDrawer } from './hooks/useFocusTrapDrawer';
import { HamburgerButton } from './components/HamburgerButton';
import AgeGate, { AGE_VERIFIED_COOKIE } from './components/AgeGate';
import CookieConsentBanner from './components/CookieConsentBanner';
import { getCookie } from './lib/cookies';
import './App.css';

function App() {
  const { itemCount } = useContext(CartContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Synchronous cookie read: no flash of gated content on first paint.
  const [isAgeVerified, setIsAgeVerified] = useState(() => getCookie(AGE_VERIFIED_COOKIE) === '1');
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

  useFocusTrapDrawer({
    open: isMobileMenuOpen,
    onClose: () => setIsMobileMenuOpen(false),
    drawerRef: navRef,
    triggerRef: hamburgerRef,
    focusSelector: 'a',
  });

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
            <img src="/logo_white.svg" alt="Miedăria Păunilor" className="logo-image logo-image-light" width={895} height={614} />
            <img src="/logo_black.svg" alt="Miedăria Păunilor" className="logo-image logo-image-dark" width={895} height={614} />
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
          <HamburgerButton
            ref={hamburgerRef}
            className="hamburger"
            onClick={toggleMobileMenu}
            open={isMobileMenuOpen}
            controls="main-navigation"
          />
        </div>
      </header>
      <ToastContainer />
      {isAgeVerified ? (
        // One decision at a time: the consent banner waits for the age gate.
        <CookieConsentBanner />
      ) : (
        <AgeGate onConfirm={() => setIsAgeVerified(true)} />
      )}
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
