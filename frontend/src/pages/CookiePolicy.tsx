import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';
import { LocalizedLink } from '../components/LocalizedLink';
import { BUSINESS_INFO } from '../lib/businessInfo';
import { resetConsent } from '../lib/consent';

type StorageType = 'cookie' | 'httpOnlyCookie' | 'localStorage' | 'sessionStorage';
type ConsentLevel = 'necessary' | 'preference' | 'optional';

interface StorageItem {
    name: 'age_verified' | 'cookie_consent' | 'cart' | '__Host-customer_session' | '__Host-google_flow' | 'admin_session' | 'pending_checkout' | 'lang' | 'i18nextLng' | 'theme' | 'newsletter_popup';
    type: StorageType;
    consent: ConsentLevel;
}

/// Must list every cookie and browser-storage key the site writes; update it
/// together with any code that adds, renames or re-scopes one.
const STORAGE_ITEMS: StorageItem[] = [
    { name: 'age_verified', type: 'cookie', consent: 'necessary' },
    { name: 'cookie_consent', type: 'cookie', consent: 'necessary' },
    { name: 'cart', type: 'cookie', consent: 'necessary' },
    { name: '__Host-customer_session', type: 'httpOnlyCookie', consent: 'necessary' },
    { name: '__Host-google_flow', type: 'httpOnlyCookie', consent: 'necessary' },
    { name: 'admin_session', type: 'httpOnlyCookie', consent: 'necessary' },
    { name: 'pending_checkout', type: 'sessionStorage', consent: 'necessary' },
    { name: 'theme', type: 'localStorage', consent: 'preference' },
    { name: 'lang', type: 'cookie', consent: 'optional' },
    { name: 'i18nextLng', type: 'localStorage', consent: 'optional' },
    { name: 'newsletter_popup', type: 'localStorage', consent: 'optional' },
];

const STRIPE_COOKIE_POLICY_URL = 'https://stripe.com/legal/cookies-policy';
const LAST_UPDATED = '2026-09-29';

function CookiePolicy() {
    const { t } = useTranslation();

    return (
        <LegalPage
            title={t('cookiePolicy.title')}
            description={t('seo.pageDescriptions.cookiePolicy')}
            intro={t('cookiePolicy.intro')}
            lastUpdated={LAST_UPDATED}
        >

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
                <div className="legal-table-wrapper">
                    <table className="legal-table">
                        <caption className="visually-hidden">{t('cookiePolicy.tableCaption')}</caption>
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
                <p>
                    {t('cookiePolicy.privacyText')}{' '}
                    <LocalizedLink to="/privacy-policy">{t('cookiePolicy.privacyLink')}</LocalizedLink>.
                </p>
            </section>
        </LegalPage>
    );
}

export default CookiePolicy;
