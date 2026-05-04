export const BUSINESS_INFO = {
  name: 'Miedăria Păunilor',
  phone: '+40760297145',
  email: 'miedaria.paunilor@gmail.com',
  streetAddress: 'Str. Principală 429B',
  locality: 'Urleta',
  country: 'RO',
  countryName: 'România',
} as const;

export function getFullAddress(): string {
  return `${BUSINESS_INFO.streetAddress}, ${BUSINESS_INFO.locality}, ${BUSINESS_INFO.countryName}`;
}
