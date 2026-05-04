export function getOrigin(): string {
  const env = import.meta.env.VITE_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
