/// Minimal first-party cookie helpers. All cookies on this site are
/// `Path=/; SameSite=Lax`, with `Secure` added automatically on HTTPS.

export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const prefix = `${name}=`;
    for (const part of document.cookie.split(';')) {
        const trimmed = part.trim();
        if (trimmed.startsWith(prefix)) {
            return decodeURIComponent(trimmed.slice(prefix.length));
        }
    }
    return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): void {
    if (typeof document === 'undefined') return;
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const secure = isHttps ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export const ONE_WEEK_SECONDS = 604_800;
export const SIX_MONTHS_SECONDS = 15_552_000;
export const ONE_YEAR_SECONDS = 31_536_000;
