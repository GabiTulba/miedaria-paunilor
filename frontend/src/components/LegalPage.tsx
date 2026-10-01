import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from './SEO';
import { useFormattedDate } from '../hooks/useFormattedDate';
import './LegalPage.css';

interface LegalPageProps {
    title: string;
    description: string;
    intro: string;
    /// ISO date (YYYY-MM-DD) of the last change to the page's wording.
    lastUpdated: string;
    children: ReactNode;
}

/// Shared frame of the cookie and privacy policies and the terms.
function LegalPage({ title, description, intro, lastUpdated, children }: LegalPageProps) {
    const { t } = useTranslation();
    const formatDate = useFormattedDate();

    return (
        <div className="legal-page">
            <SEO title={title} description={description} />
            <header className="legal-page-header">
                <h1>{title}</h1>
                <p>{intro}</p>
                <p className="legal-page-updated">{t('legal.lastUpdated', { date: formatDate(lastUpdated) })}</p>
            </header>
            {children}
        </div>
    );
}

export default LegalPage;
