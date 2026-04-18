#!/usr/bin/env bash
# Smoke test: static checks + live API tests if Docker is running.
# Usage: ./smoke-test.sh [base_url]
# Default base_url: https://localhost

set -euo pipefail

BASE_URL="${1:-https://localhost}"
PASS=0
FAIL=0

green() { printf '\033[32m[PASS]\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
red()   { printf '\033[31m[FAIL]\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
section() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

# ── Static checks ──────────────────────────────────────────────────────────────

section "Backend (Rust)"

if (cd backend && cargo check --quiet 2>&1); then
    green "cargo check"
else
    red "cargo check"
fi

if (cd backend && cargo clippy --quiet 2>&1 | grep -q "^error"); then
    red "cargo clippy (errors present)"
else
    green "cargo clippy"
fi

section "Frontend (TypeScript)"

if (cd frontend && npm run build --silent 2>&1 | grep -q "built in"); then
    green "npm run build"
else
    red "npm run build"
fi

# ── Live API tests (skip if Docker not running) ────────────────────────────────

if ! docker compose ps 2>/dev/null | grep -q "running"; then
    printf '\n\033[33m[SKIP]\033[0m Docker not running — skipping live API tests\n'
    printf '       Start with: docker-compose up --build\n'
else
    section "Live API (${BASE_URL})"

    CURL="curl -sk --max-time 5"

    # Health
    if $CURL "${BASE_URL}/health" | grep -q "ok\|healthy\|200\|{}"; then
        green "GET /health"
    else
        red "GET /health"
    fi

    # Enums
    if $CURL "${BASE_URL}/api/enums" | grep -q "hidromel"; then
        green "GET /api/enums"
    else
        red "GET /api/enums"
    fi

    # Products list
    if $CURL "${BASE_URL}/api/products" | grep -q "\[\|\]"; then
        green "GET /api/products"
    else
        red "GET /api/products"
    fi

    # Sitemap data — verify domain from env, not hardcoded
    SITEMAP=$($CURL "${BASE_URL}/api/sitemap-data")
    if echo "$SITEMAP" | grep -q "loc"; then
        green "GET /api/sitemap-data"
        # Check domain isn't the old hardcoded one
        if echo "$SITEMAP" | grep -q "miedaria-paunilor.ro"; then
            red "  sitemap still has hardcoded domain"
        else
            green "  sitemap domain from env (not hardcoded)"
        fi
    else
        red "GET /api/sitemap-data"
    fi

    # Blog list
    if $CURL "${BASE_URL}/api/blog" | grep -q "\[\|\]"; then
        green "GET /api/blog"
    else
        red "GET /api/blog"
    fi

    # Admin login — wrong password → 401
    STATUS=$($CURL -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"__wrong__"}' \
        "${BASE_URL}/api/admin/login")
    if [ "$STATUS" = "401" ]; then
        green "POST /api/admin/login wrong pw → 401"
    else
        red "POST /api/admin/login wrong pw → expected 401, got ${STATUS}"
    fi

    # Admin login — correct password → 200 + token
    ADMIN_PASS="${ADMIN_PASSWORD:-password}"
    LOGIN=$($CURL -X POST \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"admin\",\"password\":\"${ADMIN_PASS}\"}" \
        "${BASE_URL}/api/admin/login")
    TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        green "POST /api/admin/login correct pw → token received"

        # Protected route with token
        STATUS=$($CURL -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer ${TOKEN}" \
            "${BASE_URL}/api/admin/protected")
        if [ "$STATUS" = "200" ]; then
            green "GET /api/admin/protected with token → 200"
        else
            red "GET /api/admin/protected with token → expected 200, got ${STATUS}"
        fi

        # Validation: product with invalid ID chars → 400
        STATUS=$($CURL -o /dev/null -w "%{http_code}" -X POST \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{"product_id":"INVALID ID!","product_name":"x","product_name_ro":"x","product_description":"x","product_description_ro":"x","ingredients":"x","ingredients_ro":"x","product_type":"hidromel","sweetness":"dry","turbidity":"crystalline","effervescence":"flat","acidity":"mild","tanins":"mild","body":"light","abv":12.0,"bottle_count":10,"bottle_size":750,"price":15.00,"price_ron":75.00,"image_id":"00000000-0000-0000-0000-000000000000","bottling_date":"2024-01-01","lot_number":1}' \
            "${BASE_URL}/api/admin/products")
        if [ "$STATUS" = "400" ]; then
            green "POST /api/admin/products invalid ID → 400"
        else
            red "POST /api/admin/products invalid ID → expected 400, got ${STATUS}"
        fi

        # Validation: product with name too long → 400
        LONG=$(printf 'x%.0s' {1..300})
        STATUS=$($CURL -o /dev/null -w "%{http_code}" -X POST \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"product_id\":\"valid-id\",\"product_name\":\"${LONG}\",\"product_name_ro\":\"x\",\"product_description\":\"x\",\"product_description_ro\":\"x\",\"ingredients\":\"x\",\"ingredients_ro\":\"x\",\"product_type\":\"hidromel\",\"sweetness\":\"dry\",\"turbidity\":\"crystalline\",\"effervescence\":\"flat\",\"acidity\":\"mild\",\"tanins\":\"mild\",\"body\":\"light\",\"abv\":12.0,\"bottle_count\":10,\"bottle_size\":750,\"price\":15.00,\"price_ron\":75.00,\"image_id\":\"00000000-0000-0000-0000-000000000000\",\"bottling_date\":\"2024-01-01\",\"lot_number\":1}" \
            "${BASE_URL}/api/admin/products")
        if [ "$STATUS" = "400" ]; then
            green "POST /api/admin/products name too long → 400"
        else
            red "POST /api/admin/products name too long → expected 400, got ${STATUS}"
        fi
    else
        red "POST /api/admin/login correct pw → no token"
    fi
fi

# ── Summary ────────────────────────────────────────────────────────────────────

printf '\n\033[1mResults: %d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
