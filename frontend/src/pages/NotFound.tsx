import { useTranslation } from 'react-i18next';
import { LocalizedLink } from '../components/LocalizedLink';
import SEO from '../components/SEO';
import './NotFound.css';

function NotFound() {
    const { t } = useTranslation();
    return (
        <div className="not-found-page">
            <SEO title={t('seo.pageTitles.notFound')} description={t('seo.pageDescriptions.notFound')} noindex />
            <div className="not-found-content">
                <h1 className="not-found-code">404</h1>
                <p className="not-found-message">{t('errors.notFound')}</p>
                <LocalizedLink to="/" className="button button-primary">{t('navigation.home')}</LocalizedLink>
                <nav className="not-found-links" aria-label={t('navigation.main')}>
                    <LocalizedLink to="/shop">{t('navigation.shop')}</LocalizedLink>
                    <LocalizedLink to="/blog">{t('blog.title')}</LocalizedLink>
                    <LocalizedLink to="/about-us">{t('navigation.aboutUs')}</LocalizedLink>
                    <LocalizedLink to="/contact">{t('navigation.contact')}</LocalizedLink>
                </nav>
            </div>
        </div>
    );
}

export default NotFound;
