import { api } from './api';
import { isLanguage } from '../hooks/useLanguage';
import type { ShopFilters } from '../hooks/useShopFilters';
import type { Page } from '../types/generated/Page';
import type { ShopFilter } from '../types/generated/ShopFilter';
import type { SiteEvent } from '../types/generated/SiteEvent';

/// Anonymous site statistics (see backend/src/analytics.rs): no cookie, no
/// storage, no identifier. Visitors asking not to be tracked send nothing,
/// and the backend ignores their events too.
const optedOut =
    navigator.doNotTrack === '1' ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
    navigator.webdriver;

export function track(event: SiteEvent) {
    if (optedOut) return;
    api.recordEvent(event).catch(() => {});
}

const SECTION_PAGES: Record<string, Page> = {
    shop: 'shop',
    lot: 'lot',
    cart: 'cart',
    checkout: 'checkout',
    blog: 'blog',
    'about-us': 'about_us',
    contact: 'contact',
    'cookie-policy': 'cookie_policy',
    'privacy-policy': 'privacy_policy',
    newsletter: 'newsletter',
    account: 'account',
};

/// Kind of page at `pathname` (`/:lang/...`), and the product or post it shows.
function describePage(pathname: string): { page: Page; productId?: string; slug?: string } {
    const [lang, section, item] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (!lang || !isLanguage(lang)) return { page: 'not_found' };
    if (!section) return { page: 'home' };
    if (section === 'shop' && item) return { page: 'product', productId: item };
    if (section === 'blog' && item) return { page: 'blog_post', slug: item };
    return { page: SECTION_PAGES[section] ?? 'not_found' };
}

let previous: { pathname: string; page: Page } | null = null;

/// Counts a page view, plus the product or blog post it shows. The first
/// page of a visit reports the referring host, which the backend reduces to
/// its kind (search, social, email or other).
export function trackPageView(pathname: string) {
    if (previous?.pathname === pathname) return;
    const { page, productId, slug } = describePage(pathname);
    const referrer = previous ? null : externalReferrer();
    track({ event: 'page_view', page, from: previous?.page ?? null, referrer });
    if (productId) track({ event: 'product_view', product_id: productId });
    if (slug) track({ event: 'blog_post_view', slug });
    previous = { pathname, page };
}

function externalReferrer(): string | null {
    try {
        const host = new URL(document.referrer).hostname;
        return host && host !== window.location.hostname ? host : null;
    } catch {
        return null;
    }
}

const FILTER_NAMES = {
    productType: 'mead_type',
    sweetness: 'sweetness',
    turbidity: 'turbidity',
    effervescence: 'effervescence',
    acidity: 'acidity',
    tannins: 'tannins',
    body: 'body',
    orderBy: 'sort_by',
} as const;

/// Counts a shop filter the visitor picked; clearing one and the search box
/// are not reported.
export function trackShopFilter<K extends keyof ShopFilters>(key: K, value: ShopFilters[K]) {
    if (value === '' || value === false) return;
    if (key === 'inStock') {
        track({ event: 'shop_filter', filter: { name: 'in_stock' } });
    } else if (key in FILTER_NAMES) {
        const name = FILTER_NAMES[key as keyof typeof FILTER_NAMES];
        track({ event: 'shop_filter', filter: { name, value } as ShopFilter });
    }
}
