use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};

/// Validates a URL-safe identifier: lowercase letters, digits, hyphens, underscores.
/// Used for both product_id and blog post slug fields.
pub fn is_valid_slug(s: &str) -> bool {
    !s.is_empty()
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

/// A 13-digit EAN-13 (GS1) code whose last digit is its check digit.
pub fn is_valid_ean13(code: &str) -> bool {
    let digits: Vec<u32> = code.chars().filter_map(|c| c.to_digit(10)).collect();
    if code.len() != 13 || digits.len() != 13 {
        return false;
    }
    let weighted: u32 = digits[..12]
        .iter()
        .enumerate()
        .map(|(i, d)| if i % 2 == 0 { *d } else { d * 3 })
        .sum();
    (10 - weighted % 10) % 10 == digits[12]
}

pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
}

pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(stored_hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ean13_check_digit() {
        assert!(is_valid_ean13("5941234567899"));
        assert!(is_valid_ean13("5940000000004"));
        assert!(!is_valid_ean13("5940000000001"));
        assert!(!is_valid_ean13("594000000000"));
        assert!(!is_valid_ean13("59400000000a1"));
        assert!(!is_valid_ean13("+594000000001"));
    }
}
