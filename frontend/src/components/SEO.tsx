import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
    canonical?: string;
    noindex?: boolean;
}

export default function SEO({ canonical, noindex = false }: SEOProps) {
    const location = useLocation();
    const path = canonical ?? location.pathname;
    const href = typeof window !== 'undefined'
        ? `${window.location.origin}${path}`
        : path;

    return (
        <Helmet>
            <link rel="canonical" href={href} />
            {noindex && <meta name="robots" content="noindex,follow" />}
        </Helmet>
    );
}
