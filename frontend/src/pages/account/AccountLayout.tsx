import { ReactNode } from 'react';
import SEO from '../../components/SEO';
import GoogleNotice from './GoogleNotice';
import './Account.css';

interface AccountLayoutProps {
    title: string;
    children: ReactNode;
    wide?: boolean;
}

/// Shared frame of the account pages (never indexed).
function AccountLayout({ title, children, wide = false }: AccountLayoutProps) {
    return (
        <div className={`account-page${wide ? ' account-page-wide' : ''}`}>
            <SEO title={title} noindex />
            <h1>{title}</h1>
            <GoogleNotice />
            {children}
        </div>
    );
}

export default AccountLayout;
