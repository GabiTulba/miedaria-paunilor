import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';
import { LocalizedLink } from '../components/LocalizedLink';
import { BUSINESS_INFO, BUSINESS_LEGAL, getFullAddress } from '../lib/businessInfo';

/// The contract terms of the shop. Must be kept in sync with how ordering,
/// payment and delivery actually work (checkout, Stripe, Sameday).
const SECTIONS = [
    'age',
    'orders',
    'prices',
    'payment',
    'delivery',
    'withdrawal',
    'conformity',
    'accounts',
    'liability',
    'intellectualProperty',
    'law',
] as const;

const ANPC_URL = 'https://anpc.ro';
const SAL_URL = 'https://anpc.ro/ce-este-sal/';
const LAST_UPDATED = '2026-10-01';

function TermsAndConditions() {
    const { t } = useTranslation();
    const mailto = <a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a>;

    return (
        <LegalPage
            title={t('terms.title')}
            description={t('seo.pageDescriptions.terms')}
            intro={t('terms.intro')}
            lastUpdated={LAST_UPDATED}
        >
            <section>
                <h2>{t('terms.sellerTitle')}</h2>
                <dl className="legal-facts">
                    <dt>{t('privacyPolicy.controller.name')}</dt>
                    <dd>{BUSINESS_LEGAL.legalName}</dd>
                    <dt>{t('privacyPolicy.controller.taxId')}</dt>
                    <dd>{BUSINESS_LEGAL.taxId}</dd>
                    <dt>{t('privacyPolicy.controller.tradeRegisterNo')}</dt>
                    <dd>{BUSINESS_LEGAL.tradeRegisterNo}</dd>
                    <dt>{t('privacyPolicy.controller.address')}</dt>
                    <dd>{getFullAddress()}</dd>
                    <dt>{t('privacyPolicy.controller.email')}</dt>
                    <dd>{mailto}</dd>
                    <dt>{t('terms.phone')}</dt>
                    <dd><a href={`tel:${BUSINESS_INFO.phone}`}>{BUSINESS_INFO.phone}</a></dd>
                </dl>
            </section>

            {SECTIONS.map(section => (
                <section key={section}>
                    <h2>{t(`terms.sections.${section}.title`)}</h2>
                    {(t(`terms.sections.${section}.paragraphs`, { returnObjects: true }) as string[]).map(paragraph => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </section>
            ))}

            <section>
                <h2>{t('terms.complaintsTitle')}</h2>
                <p>{t('terms.complaintsText')} {mailto}.</p>
                <p>
                    {t('terms.authorityText')}{' '}
                    <a href={ANPC_URL} target="_blank" rel="noopener noreferrer">ANPC</a>
                    {' · '}
                    <a href={SAL_URL} target="_blank" rel="noopener noreferrer">{t('terms.salLink')}</a>.
                </p>
            </section>

            <section>
                <h2>{t('terms.privacyTitle')}</h2>
                <p>
                    {t('terms.privacyText')}{' '}
                    <LocalizedLink to="/privacy-policy">{t('footer.privacyPolicy')}</LocalizedLink>
                    {' · '}
                    <LocalizedLink to="/cookie-policy">{t('footer.cookiePolicy')}</LocalizedLink>.
                </p>
            </section>

            <section>
                <h2>{t('terms.changesTitle')}</h2>
                <p>{t('terms.changesText')}</p>
            </section>
        </LegalPage>
    );
}

export default TermsAndConditions;
