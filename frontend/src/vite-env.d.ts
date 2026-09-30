/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_BUSINESS_LEGAL_NAME: string;
  readonly VITE_BUSINESS_TAX_ID: string;
  readonly VITE_BUSINESS_TRADE_REGISTER_NO: string;
  readonly VITE_SITE_MODE: 'dev' | 'prod';
  readonly VITE_SITE_MODE: 'dev' | 'prod';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
