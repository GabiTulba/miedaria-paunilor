import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';
import { LocalizedLink } from '../components/LocalizedLink';
import { BUSINESS_INFO, BUSINESS_LEGAL, getFullAddress } from '../lib/businessInfo';

/// Every purpose for which the site processes personal data. Must be kept in
/// sync with what the code collects: update it together with any change that
/// stores, logs or shares a new kind of personal data.
const ACTIVITIES = ['orders', 'payments', 'newsletter', 'contact', 'security'] as const;
const ACTIVITY_FACTS = ['data', 'purpose', 'legalBasis', 'retention'] as const;

const RECIPIENTS: { name: 'hosting' | 'stripe' | 'brevo' | 'google' | 'whatsapp' | 'courier' | 'authorities'; policyUrl?: string }[] = [
    { name: 'hosting' },
    { name: 'stripe', policyUrl: 'https://stripe.com/privacy' },
    { name: 'brevo', policyUrl: 'https://www.brevo.com/legal/privacypolicy/' },
    { name: 'google', policyUrl: 'https://policies.google.com/privacy' },
    { name: 'whatsapp', policyUrl: 'https://www.whatsapp.com/legal/privacy-policy-eea' },
    { name: 'courier' },
    { name: 'authorities' },
];

const RIGHTS = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'withdrawConsent'] as const;

const SUPERVISORY_AUTHORITY_URL = 'https://www.dataprotection.ro';
const LAST_UPDATED = '2026-09-28';

function PrivacyPolicy() {
    const { t } = useTranslation();
    const mailto = <a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a>;

    return (
        <LegalPage
            title={t('privacyPolicy.title')}
            description={t('seo.pageDescriptions.privacyPolicy')}
            intro={t('privacyPolicy.intro')}
            lastUpdated={LAST_UPDATED}
        >
            <section>
                <h2>{t('privacyPolicy.controllerTitle')}</h2>
                <p>{t('privacyPolicy.controllerText')}</p>
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
                </dl>
            </section>

            <section>
                <h2>{t('privacyPolicy.activitiesTitle')}</h2>
                <p>{t('privacyPolicy.activitiesText')}</p>
                {ACTIVITIES.map(activity => (
                    <article key={activity}>
                        <h3>{t(`privacyPolicy.activities.${activity}.title`)}</h3>
                        <dl className="legal-facts">
                            {ACTIVITY_FACTS.map(fact => [
                                <dt key={`${fact}-label`}>{t(`privacyPolicy.facts.${fact}`)}</dt>,
                                <dd key={fact}>{t(`privacyPolicy.activities.${activity}.${fact}`)}</dd>,
                            ])}
                        </dl>
                    </article>
                ))}
                <p>
                    {t('privacyPolicy.cookiesText')}{' '}
                    <LocalizedLink to="/cookie-policy">{t('privacyPolicy.cookiesLink')}</LocalizedLink>.
                </p>
            </section>

            <section>
                <h2>{t('privacyPolicy.recipientsTitle')}</h2>
                <p>{t('privacyPolicy.recipientsText')}</p>
                <ul>
                    {RECIPIENTS.map(({ name, policyUrl }) => (
                        <li key={name}>
                            {t(`privacyPolicy.recipients.${name}`)}
                            {policyUrl && (
                                <>
                                    {' '}
                                    <a href={policyUrl} target="_blank" rel="noopener noreferrer">
                                        {t('privacyPolicy.recipientPolicyLink')}
                                    </a>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
                <p>{t('privacyPolicy.noSaleText')}</p>
            </section>

            <section>
                <h2>{t('privacyPolicy.transfersTitle')}</h2>
                <p>{t('privacyPolicy.transfersText')}</p>
            </section>

            <section>
                <h2>{t('privacyPolicy.rightsTitle')}</h2>
                <p>{t('privacyPolicy.rightsText')}</p>
                <ul>
                    {RIGHTS.map(right => (
                        <li key={right}>{t(`privacyPolicy.rights.${right}`)}</li>
                    ))}
                </ul>
                <p>{t('privacyPolicy.rightsHowTo')} {mailto}.</p>
                <p>
                    {t('privacyPolicy.complaintText')}{' '}
                    <a href={SUPERVISORY_AUTHORITY_URL} target="_blank" rel="noopener noreferrer">
                        {t('privacyPolicy.complaintLink')}
                    </a>.
                </p>
            </section>

            <section>
                <h2>{t('privacyPolicy.securityTitle')}</h2>
                <p>{t('privacyPolicy.securityText')}</p>
            </section>

            <section>
                <h2>{t('privacyPolicy.automatedTitle')}</h2>
                <p>{t('privacyPolicy.automatedText')}</p>
            </section>

            <section>
                <h2>{t('privacyPolicy.minorsTitle')}</h2>
                <p>{t('privacyPolicy.minorsText')}</p>
            </section>

            <section>
                <h2>{t('privacyPolicy.changesTitle')}</h2>
                <p>{t('privacyPolicy.changesText')}</p>
            </section>
        </LegalPage>
    );
}

export default PrivacyPolicy;
