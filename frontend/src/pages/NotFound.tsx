import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import './NotFound.css';

function NotFound() {
    const { t } = useTranslation();
    return (
        <div className="not-found-page">
            <SEO noindex />
            <div className="not-found-content">
                <h1 className="not-found-code">404</h1>
                <p className="not-found-message">{t('errors.notFound')}</p>
                <Link to="/" className="button button-primary">{t('navigation.home')}</Link>
            </div>
        </div>
    );
}

export default NotFound;
