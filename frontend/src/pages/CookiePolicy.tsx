import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BUSINESS_INFO } from '../lib/businessInfo';
import { resetConsent } from '../lib/consent';
import './CookiePolicy.css';

type StorageType = 'cookie' | 'httpOnlyCookie' | 'localStorage' | 'sessionStorage';
type ConsentLevel = 'necessary' | 'preference' | 'optional';

interface StorageItem {
    name: 'age_verified' | 'cookie_consent' | 'cart' | 'admin_session' | 'pending_checkout' | 'lang' | 'i18nextLng' | 'theme';
    type: StorageType;
    consent: ConsentLevel;
}

/// Must list every cookie and browser-storage key the site writes; update it
/// together with any code that adds, renames or re-scopes one.
const STORAGE_ITEMS: StorageItem[] = [
    { name: 'age_verified', type: 'cookie', consent: 'necessary' },
    { name: 'cookie_consent', type: 'cookie', consent: 'necessary' },
    { name: 'cart', type: 'cookie', consent: 'necessary' },
    { name: 'admin_session', type: 'httpOnlyCookie', consent: 'necessary' },
    { name: 'pending_checkout', type: 'sessionStorage', consent: 'necessary' },
    { name: 'theme', type: 'localStorage', consent: 'preference' },
    { name: 'lang', type: 'cookie', consent: 'optional' },
    { name: 'i18nextLng', type: 'localStorage', consent: 'optional' },
];

const STRIPE_COOKIE_POLICY_URL = 'https://stripe.com/legal/cookies-policy';

function CookiePolicy() {
    const { t } = useTranslation();

    return (
        <div className="cookie-policy-page">
            <SEO title={t('seo.pageTitles.cookiePolicy')} description={t('seo.pageDescriptions.cookiePolicy')} />
            <header className="cookie-policy-header">
                <h1>{t('cookiePolicy.title')}</h1>
                <p>{t('cookiePolicy.intro')}</p>
            </header>

            <section>
                <h2>{t('cookiePolicy.whatTitle')}</h2>
                <p>{t('cookiePolicy.whatText')}</p>
            </section>

            <section>
                <h2>{t('cookiePolicy.noTrackingTitle')}</h2>
                <p>{t('cookiePolicy.noTrackingText')}</p>
            </section>

            <section>
                <h2>{t('cookiePolicy.inventoryTitle')}</h2>
                <div className="cookie-policy-table-wrapper">
                    <table className="cookie-policy-table">
                        <caption>{t('cookiePolicy.tableCaption')}</caption>
                        <thead>
                            <tr>
                                <th scope="col">{t('cookiePolicy.columns.name')}</th>
                                <th scope="col">{t('cookiePolicy.columns.type')}</th>
                                <th scope="col">{t('cookiePolicy.columns.purpose')}</th>
                                <th scope="col">{t('cookiePolicy.columns.lifetime')}</th>
                                <th scope="col">{t('cookiePolicy.columns.consent')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {STORAGE_ITEMS.map(item => (
                                <tr key={item.name}>
                                    <th scope="row" data-label={t('cookiePolicy.columns.name')}><code>{item.name}</code></th>
                                    <td data-label={t('cookiePolicy.columns.type')}>{t(`cookiePolicy.types.${item.type}`)}</td>
                                    <td data-label={t('cookiePolicy.columns.purpose')}>{t(`cookiePolicy.items.${item.name}.purpose`)}</td>
                                    <td data-label={t('cookiePolicy.columns.lifetime')}>{t(`cookiePolicy.items.${item.name}.lifetime`)}</td>
                                    <td data-label={t('cookiePolicy.columns.consent')}>{t(`cookiePolicy.consent.${item.consent}`)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2>{t('cookiePolicy.thirdPartyTitle')}</h2>
                <p>
                    {t('cookiePolicy.thirdPartyText')}{' '}
                    <a href={STRIPE_COOKIE_POLICY_URL} target="_blank" rel="noopener noreferrer">
                        {t('cookiePolicy.stripeLink')}
                    </a>
                </p>
            </section>

            <section>
                <h2>{t('cookiePolicy.manageTitle')}</h2>
                <p>{t('cookiePolicy.manageText')}</p>
                <button type="button" className="button" onClick={resetConsent}>
                    {t('cookiePolicy.manageButton')}
                </button>
            </section>

            <section>
                <h2>{t('cookiePolicy.contactTitle')}</h2>
                <p>
                    {t('cookiePolicy.contactText')}{' '}
                    <a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a>.
                </p>
            </section>
        </div>
    );
}

export default CookiePolicy;
