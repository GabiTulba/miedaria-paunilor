import { useTranslation } from 'react-i18next'; 
import './Contact.css'; 

function Contact() { 
    const { t } = useTranslation(); 
    
    
    const phone = "+40760297145";
    const email = "miedaria.paunilor@gmail.com";
    const address = "Str. Principală 429B, Urleta, România";
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

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
                            <span>
                                {t('contact.phone')}: 
                                <a href={`tel:${phone}`}> +40 760 297 145</a>
                            </span> 
                        </li> 
                        <li> 
                            <i className="icon-email"></i> 
                            <span>
                                {t('contact.email')}: 
                                <a href={`mailto:${email}`}> {email}</a>
                            </span> 
                        </li> 
                        <li> 
                            <i className="icon-location"></i> 
                            <span>
                                {t('contact.address')}: <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"> {address}</a>
                            </span> 
                        </li> 
                    </ul> 
                </div> 
            </div> 
        </div> 
    ); 
} 

export default Contact;