/// Only a path inside this site (`/…`, not `//host` or `/\host`) may be a
/// post-login destination, so a crafted login link cannot send the customer
/// to another site.
export function safeReturnPath(raw: string | null): string | null {
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
    return raw;
}
