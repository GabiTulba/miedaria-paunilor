use std::path::Path;
use std::process::Command;

#[test]
fn generated_typescript_bindings_are_committed() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let repo_root = Path::new(manifest_dir).parent().expect("repo root");

    let output = Command::new("git")
        .args([
            "status",
            "--porcelain",
            "--",
            "frontend/src/types/generated/",
        ])
        .current_dir(repo_root)
        .output()
        .expect("failed to invoke git");

    assert!(
        output.status.success(),
        "git status exited non-zero: stderr={}",
        String::from_utf8_lossy(&output.stderr)
    );

    let dirty = String::from_utf8_lossy(&output.stdout);
    assert!(
        dirty.trim().is_empty(),
        "Generated TypeScript bindings under frontend/src/types/generated/ are out of date.\n\
         The following files differ from what `cargo test --lib` produced:\n\n{}\n\
         Run `scripts/check-codegen.sh` (or `cargo test --lib` from backend/) and \
         commit the resulting changes.",
        dirty
    );
}
