import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { LocalizedLink } from '../components/LocalizedLink';
import './Newsletter.css';

interface NewsletterLayoutProps {
    title: string;
    children: ReactNode;
}

/// Shared frame of the confirmation and unsubscribe pages (never indexed).
function NewsletterLayout({ title, children }: NewsletterLayoutProps) {
    const { t } = useTranslation();
    return (
        <div className="newsletter-page">
            <SEO title={title} noindex />
            <h1>{title}</h1>
            <div aria-live="polite">{children}</div>
            <LocalizedLink to="/" className="button">{t('navigation.home')}</LocalizedLink>
        </div>
    );
}

export default NewsletterLayout;
