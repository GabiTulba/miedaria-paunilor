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
                    <ul>
                        <li>
                            <i className="icon-phone"></i>
                            <span>{t('contact.phone')}: +40 760 297 145</span>
                        </li>
                        <li>
                            <i className="icon-email"></i>
                            <span>{t('contact.email')}: tulbalecuh@gmail.com</span>
                        </li>
                        <li>
                            <i className="icon-location"></i>
                            <span>{t('contact.address')}: Str. Principală, Nr. 429B, Urleta, Prahova, România</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Contact;
