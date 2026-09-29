//! Secrets sent by email or cookie. Only their hashes (or HMACs) are ever
//! stored, the same posture as password hashing.

use argon2::password_hash::rand_core::{OsRng, RngCore};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

/// 256-bit random value, hex-encoded.
pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Random HMAC key that never leaves process memory.
pub fn random_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    key
}

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub fn mac(key: &[u8], data: &[u8]) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac
}

pub fn mac_hex(key: &[u8], data: &[u8]) -> String {
    hex::encode(mac(key, data).finalize().into_bytes())
}

/// Key for one purpose, derived from `secret` under its own label so keys of
/// different purposes (and the JWT signature) can never stand in for each other.
pub fn derive_key(secret: &str, label: &[u8]) -> [u8; 32] {
    mac(secret.as_bytes(), label).finalize().into_bytes().into()
}

/// Constant-time check of a hex-encoded HMAC of `data`.
pub fn verify_mac_hex(key: &[u8], data: &[u8], token: &str) -> bool {
    hex::decode(token)
        .map(|bytes| mac(key, data).verify_slice(&bytes).is_ok())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_hash_is_stable_hex() {
        let token = random_token();
        assert_eq!(token.len(), 64);
        assert_ne!(token, random_token());
        assert_eq!(hash_token(&token), hash_token(&token));
        assert_eq!(hash_token(&token).len(), 64);
    }

    #[test]
    fn macs_are_bound_to_key_and_data() {
        let key = derive_key("secret", b"label");
        let token = mac_hex(&key, b"data");
        assert!(verify_mac_hex(&key, b"data", &token));
        assert!(!verify_mac_hex(&key, b"other", &token));
        assert!(!verify_mac_hex(
            &derive_key("secret", b"other-label"),
            b"data",
            &token
        ));
        assert!(!verify_mac_hex(&key, b"data", "zz"));
    }
}
