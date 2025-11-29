use sha2::{Sha256, Digest};

pub fn salt_and_hash(salt: &str, password: &str) -> String {
    let hash = Sha256::digest(format!("{}{}", salt, password).as_bytes());
    
    format!("{:x}", hash)
}