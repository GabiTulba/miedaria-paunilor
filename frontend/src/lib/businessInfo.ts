export const BUSINESS_INFO = {
  name: 'Miedăria Păunilor',
  phone: '+40760297145',
  email: 'miedaria.paunilor@gmail.com',
  streetAddress: 'Str. Principală 429B',
  locality: 'Urleta',
  county: 'Prahova',
  country: 'RO',
  countryName: 'România',
} as const;

/// Identity of the data controller named in the privacy policy, set at build
/// time from the root `.env` (checked in vite.config.ts).
export const BUSINESS_LEGAL = {
  legalName: import.meta.env.VITE_BUSINESS_LEGAL_NAME,
  taxId: import.meta.env.VITE_BUSINESS_TAX_ID,
  tradeRegisterNo: import.meta.env.VITE_BUSINESS_TRADE_REGISTER_NO,
} as const;

export function getFullAddress(): string {
  return `${BUSINESS_INFO.streetAddress}, ${BUSINESS_INFO.locality}, ${BUSINESS_INFO.countryName}`;
}
