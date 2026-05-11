#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

(
    cd "$repo_root/backend"
    cargo test --lib --quiet -- --nocapture >/dev/null
)

cd "$repo_root"
if [ -n "$(git status --porcelain -- frontend/src/types/generated/)" ]; then
    echo "ERROR: Generated TypeScript bindings are out of date." >&2
    git status --short -- frontend/src/types/generated/ >&2
    echo >&2
    echo "Commit the regenerated files under frontend/src/types/generated/." >&2
    exit 1
fi

echo "OK: generated TS bindings are up to date."
