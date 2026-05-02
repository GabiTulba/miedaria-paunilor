import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './NotFound.css';

function NotFound() {
    const { t } = useTranslation();
    return (
        <div className="not-found-page">
            <div className="not-found-content">
                <h1 className="not-found-code">404</h1>
                <p className="not-found-message">{t('errors.notFound')}</p>
                <Link to="/home" className="button button-primary">{t('navigation.home')}</Link>
            </div>
        </div>
    );
}

export default NotFound;
