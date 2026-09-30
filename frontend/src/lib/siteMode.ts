/// `MODE` from the root `.env`, baked in at build time (checked in
/// vite.config.ts): `dev` marks the site as a test copy.
export const IS_DEV_SITE = import.meta.env.VITE_SITE_MODE === 'dev';
