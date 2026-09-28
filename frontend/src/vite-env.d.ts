/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_BUSINESS_LEGAL_NAME: string;
  readonly VITE_BUSINESS_TAX_ID: string;
  readonly VITE_BUSINESS_TRADE_REGISTER_NO: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
