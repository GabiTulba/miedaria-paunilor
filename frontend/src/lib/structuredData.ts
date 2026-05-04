import { BUSINESS_INFO } from './businessInfo';
import { LocalizedProduct, LocalizedBlogPost } from '../types';
import { isInStock } from '../utils/stockAvailability';

const SCHEMA_CONTEXT = 'https://schema.org';

export function buildOrganizationLd(origin: string) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: BUSINESS_INFO.name,
    url: origin || undefined,
    logo: `${origin}/logo.svg`,
    email: BUSINESS_INFO.email,
    telephone: BUSINESS_INFO.phone,
  };
}

export function buildLocalBusinessLd(origin: string) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'LocalBusiness',
    '@id': `${origin}/#localbusiness`,
    name: BUSINESS_INFO.name,
    url: origin || undefined,
    image: `${origin}/logo.svg`,
    telephone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.streetAddress,
      addressLocality: BUSINESS_INFO.locality,
      addressCountry: BUSINESS_INFO.country,
    },
  };
}

interface ProductLdParams {
  product: LocalizedProduct;
  imageUrl?: string | null;
  pageUrl: string;
}

export function buildProductLd({ product, imageUrl, pageUrl }: ProductLdParams) {
  const ld: Record<string, unknown> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    name: product.product_name,
    description: product.product_description,
    sku: product.product_id,
    brand: {
      '@type': 'Brand',
      name: BUSINESS_INFO.name,
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency,
      availability: isInStock(product.bottle_count)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: pageUrl,
    },
  };
  if (imageUrl) ld.image = imageUrl;
  return ld;
}

interface ArticleLdParams {
  post: LocalizedBlogPost;
  origin: string;
  pageUrl: string;
  imageUrl?: string | null;
}

export function buildArticleLd({ post, origin, pageUrl, imageUrl }: ArticleLdParams) {
  const ld: Record<string, unknown> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: BUSINESS_INFO.name,
      logo: { '@type': 'ImageObject', url: `${origin}/logo.svg` },
    },
    mainEntityOfPage: pageUrl,
  };
  if (post.published_at) ld.datePublished = post.published_at;
  if (post.updated_at) ld.dateModified = post.updated_at;
  if (imageUrl) ld.image = imageUrl;
  return ld;
}

export interface BreadcrumbLdItem {
  name: string;
  url?: string;
}

export function buildBreadcrumbLd(items: BreadcrumbLdItem[], origin: string) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const entry: Record<string, unknown> = {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
      };
      if (item.url) entry.item = `${origin}${item.url}`;
      return entry;
    }),
  };
}
