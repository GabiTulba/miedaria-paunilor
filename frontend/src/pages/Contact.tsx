import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BUSINESS_INFO, getFullAddress } from '../lib/businessInfo';
import './Contact.css';

function Contact() {
    const { t } = useTranslation();

    const address = getFullAddress();
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    const displayPhone = '+40 760 297 145';

    return (
        <div className="contact-page">
            <SEO title={t('seo.pageTitles.contact')} description={t('seo.pageDescriptions.contact')} />
            <header className="contact-header">
                <h1>{t('contact.title')}</h1>
                <p>{t('contact.formTitle')}</p>
            </header>
            <div className="contact-content">
                <div className="contact-info">
                    <ul>
                        <li>
                            <i className="icon-phone"></i>
                            <span>
                                {t('contact.phone')}:
                                <a href={`tel:${BUSINESS_INFO.phone}`}> {displayPhone}</a>
                            </span>
                        </li>
                        <li>
                            <i className="icon-email"></i>
                            <span>
                                {t('contact.email')}:
                                <a href={`mailto:${BUSINESS_INFO.email}`}> {BUSINESS_INFO.email}</a>
                            </span>
                        </li>
                        <li>
                            <i className="icon-location"></i>
                            <span>
                                {t('contact.address')}: <a
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t('contact.addressNewTab', { address })}
                                > {address}</a>
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Contact;
