import { useTranslation } from 'react-i18next';
import './Contact.css';

function Contact() {
    const { t } = useTranslation();
    
    return (
        <div className="contact-page">
            <header className="contact-header">
                <h1>{t('contact.title')}</h1>
                <p>{t('contact.formTitle')}</p>
            </header>
            <div className="contact-content">
                <div className="contact-info">
                    <h3>{t('contact.title')}</h3>
                    <p>{t('contact.formTitle')}</p>
                    <ul>
                        <li>
                            <i className="icon-phone"></i>
                            <span>{t('contact.phone')}: +40 123 456 789</span>
                        </li>
                        <li>
                            <i className="icon-email"></i>
                            <span>{t('contact.email')}: contact@miedaria-paunilor.ro</span>
                        </li>
                        <li>
                            <i className="icon-location"></i>
                            <span>{t('contact.address')}: Str. Fagului, Nr. 1, Brașov, Romania</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Contact;
