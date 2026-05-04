import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage, SUPPORTED_LANGUAGES, Language, DEFAULT_LANGUAGE } from '../hooks/useLanguage';
import { getOrigin } from '../lib/origin';

const OG_LOCALE: Record<Language, string> = {
  ro: 'ro_RO',
  en: 'en_US',
};

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  structuredData?: object | object[];
  canonicalPath?: string;
}

function swapLangPrefix(pathname: string, target: Language): string {
  const match = pathname.match(/^\/(ro|en)(\/|$)/);
  if (match) {
    const rest = pathname.slice(match[1].length + 1);
    return `/${target}${rest}`;
  }
  return `/${target}${pathname === '/' ? '' : pathname}`;
}

function resolveImageUrl(origin: string, image?: string): string {
  if (!image) return `${origin}/logo.svg`;
  if (/^https?:\/\//i.test(image)) return image;
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

export default function SEO({
  title,
  description,
  image,
  type = 'website',
  noindex = false,
  structuredData,
  canonicalPath,
}: SEOProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const lang = useLanguage();

  const origin = getOrigin();
  const pathname = canonicalPath ?? location.pathname;
  const canonicalUrl = `${origin}${pathname}`;
  const siteName = t('seo.siteName');
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const desc = description ?? t('seo.pageDescriptions.home');
  const ogImage = resolveImageUrl(origin, image);

  const ldArray = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet htmlAttributes={{ lang }}>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonicalUrl} />

      {SUPPORTED_LANGUAGES.map(altLang => (
        <link
          key={altLang}
          rel="alternate"
          hrefLang={altLang}
          href={`${origin}${swapLangPrefix(pathname, altLang)}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${origin}${swapLangPrefix(pathname, DEFAULT_LANGUAGE)}`}
      />

      {noindex && <meta name="robots" content="noindex,follow" />}

      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={OG_LOCALE[lang]} />
      {SUPPORTED_LANGUAGES.filter(l => l !== lang).map(l => (
        <meta key={l} property="og:locale:alternate" content={OG_LOCALE[l]} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}
