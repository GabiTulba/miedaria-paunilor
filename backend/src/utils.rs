use sha2::{Sha256, Digest};

pub fn salt_and_hash(salt: &str, password: &str) -> String {
    let hash = Sha256::digest(format!("{}{}", salt, password).as_bytes());
    let hashed_string = format!("{:x}", hash);
    hashed_string
}

pub fn verify_password(password: &str, salt: &str, stored_hash: &str) -> bool {
    let computed_hash = salt_and_hash(salt, password);
    computed_hash == stored_hash
}