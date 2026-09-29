export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/// Whether a new password can be submitted. The server enforces the full
/// policy (length and a common-password blocklist); this only catches typos
/// early. Length counts characters, as on the server.
export function passwordsReady(password: string, confirmation: string): boolean {
    return [...password].length >= MIN_PASSWORD_LENGTH && password === confirmation;
}
