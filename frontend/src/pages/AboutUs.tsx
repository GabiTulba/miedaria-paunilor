import { useTranslation } from 'react-i18next';
import './AboutUs.css';

function AboutUs() {
    const { t } = useTranslation();
    
    return (
        <div className="about-us-page">
            <div className="about-hero">
                <div className="about-hero-content">
                    <h1>{t('about.title')}: {t('about.story')}</h1>
                </div>
            </div>
            <div className="about-content">
                <section className="about-section">
                    <h2>{t('about.mission')}</h2>
                    <p>
                        {t('home.ourStoryDescription')}
                    </p>
                </section>
                <section className="about-section">
                    <h2>{t('about.values')}</h2>
                    <p>{t('about.valuesDescription')}</p>
                </section>
            </div>
        </div>
    );
}

export default AboutUs;
