#!/bin/bash
# Pagination test script: seeds 25 products + 15 blog posts, validates pagination endpoints.
# Usage: ./test_pagination.sh [--keep] [BASE_URL]
# Flags:
#   --keep   Do not delete seeded test data after run
# Example: BASE_URL=http://localhost:8000 ./test_pagination.sh
#          ./test_pagination.sh --keep https://localhost

set -uo pipefail

KEEP_DATA=false
BASE_URL="${BASE_URL:-https://localhost}"
for arg in "$@"; do
    case "$arg" in
        --keep) KEEP_DATA=true ;;
        *)      BASE_URL="$arg" ;;
    esac
done

ADMIN_USER="${ADMIN_USERNAME:-admin}"
ADMIN_PASS="${ADMIN_PASSWORD:-password}"
CURL="curl -sk"

PASS=0
FAIL=0
TOKEN=""
CREATED_PRODUCT_IDS=()
CREATED_BLOG_IDS=()
IMAGE_ID=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}FAIL${NC} $1"; ((FAIL++)); }
info() { echo -e "${YELLOW}----${NC} $1"; }

check_count() {
    local desc="$1" expected="$2" url="$3"
    local actual
    actual=$($CURL "$url" | jq 'length' 2>/dev/null || echo "-1")
    if [ "$actual" -eq "$expected" ]; then
        pass "$desc (got $actual)"
    else
        fail "$desc (expected $expected, got $actual)"
    fi
}

check_empty() {
    local desc="$1" url="$2"
    local actual
    actual=$($CURL "$url" | jq 'length' 2>/dev/null || echo "-1")
    if [ "$actual" -eq 0 ]; then
        pass "$desc (got 0)"
    else
        fail "$desc (expected 0, got $actual)"
    fi
}

check_lte() {
    local desc="$1" max="$2" url="$3"
    local actual
    actual=$($CURL "$url" | jq 'length' 2>/dev/null || echo "-1")
    if [ "$actual" -le "$max" ] && [ "$actual" -gt 0 ]; then
        pass "$desc (got $actual <= $max)"
    else
        fail "$desc (expected 1-$max, got $actual)"
    fi
}

cleanup() {
    if [ "$KEEP_DATA" = true ]; then
        info "Skipping cleanup (--keep). Test data left in DB."
        return
    fi
    info "Cleaning up test data..."
    for id in "${CREATED_PRODUCT_IDS[@]:-}"; do
        $CURL -X DELETE -H "Authorization: Bearer ${TOKEN:-}" "$BASE_URL/api/admin/products/$id" > /dev/null 2>&1 || true
    done
    for id in "${CREATED_BLOG_IDS[@]:-}"; do
        $CURL -X DELETE -H "Authorization: Bearer ${TOKEN:-}" "$BASE_URL/api/admin/blog/$id" > /dev/null 2>&1 || true
    done
    if [ -n "$IMAGE_ID" ]; then
        $CURL -X DELETE -H "Authorization: Bearer ${TOKEN:-}" "$BASE_URL/api/admin/images/$IMAGE_ID" > /dev/null 2>&1 || true
    fi
    echo ""
    info "Cleanup done."
}

# Ensure cleanup runs on exit
trap cleanup EXIT

# ── 1. Login ──────────────────────────────────────────────────────────────────
info "Logging in as $ADMIN_USER at $BASE_URL..."
LOGIN_RESP=$($CURL -X POST "$BASE_URL/api/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}") || true
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token' 2>/dev/null || true)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}Login failed.${NC}"
    echo "  URL:      $BASE_URL/api/admin/login"
    echo "  User:     $ADMIN_USER"
    echo "  Response: $LOGIN_RESP"
    echo "  Hint: Is the stack running? Try: docker-compose up --build"
    exit 1
fi
info "Login OK. Token acquired."

# ── 2. Upload test image (minimal 1x1 PNG) ────────────────────────────────────
info "Uploading test image..."
python3 -c "
import zlib, struct, sys
sig = b'\x89PNG\r\n\x1a\n'
def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
idat = chunk(b'IDAT', zlib.compress(b'\x00\xff\xff\xff'))
iend = chunk(b'IEND', b'')
sys.stdout.buffer.write(sig + ihdr + idat + iend)
" > /tmp/test_pagination_img.png

UPLOAD_RESP=$($CURL -X POST "$BASE_URL/api/admin/images" \
    -H "Authorization: Bearer ${TOKEN:-}" \
    -F "file=@/tmp/test_pagination_img.png;filename=test_pagination_img.png")
IMAGE_ID=$(echo "$UPLOAD_RESP" | jq -r '.id' 2>/dev/null)
if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo -e "${RED}Image upload failed. Response: $UPLOAD_RESP${NC}"
    exit 1
fi
info "Image uploaded: $IMAGE_ID"

# ── 3. Create 200 products ────────────────────────────────────────────────────
PRODUCT_TYPES=(hidromel melomel metheglin bochet braggot pyment cyser rhodomel capsicumel acerglyn)
SWEETNESS=(bone-dry dry semi-dry semi-sweet sweet dessert)
TURBIDITY=(crystalline hazy cloudy)

info "Creating 200 test products..."
for i in $(seq 1 200); do
    ptype=${PRODUCT_TYPES[$(( (i-1) % 10 ))]}
    sweet=${SWEETNESS[$(( (i-1) % 6 ))]}
    turb=${TURBIDITY[$(( (i-1) % 3 ))]}
    first=$(printf "\\x$(printf '%02x' $((97 + (i-1)/26)))")
    second=$(printf "\\x$(printf '%02x' $((97 + (i-1)%26)))")
    pid="test-product-${first}${second}"

    RESP=$($CURL -X POST "$BASE_URL/api/admin/products" \
        -H "Authorization: Bearer ${TOKEN:-}" \
        -H "Content-Type: application/json" \
        -d "{
            \"product_id\": \"$pid\",
            \"product_name\": \"Test Product $i\",
            \"product_name_ro\": \"Produs Test $i\",
            \"product_description\": \"Test description for product $i\",
            \"product_description_ro\": \"Descriere test pentru produsul $i\",
            \"ingredients\": \"honey, water\",
            \"ingredients_ro\": \"miere, apa\",
            \"product_type\": \"$ptype\",
            \"sweetness\": \"$sweet\",
            \"turbidity\": \"$turb\",
            \"effervescence\": \"flat\",
            \"acidity\": \"mild\",
            \"tanins\": \"mild\",
            \"body\": \"light\",
            \"abv\": 12.0,
            \"bottle_count\": 100,
            \"bottle_size\": 750,
            \"price\": 20.00,
            \"price_ron\": 100.00,
            \"image_id\": \"$IMAGE_ID\",
            \"bottling_date\": \"2024-01-01\",
            \"lot_number\": $i
        }")
    CREATED_ID=$(echo "$RESP" | jq -r '.product_id' 2>/dev/null)
    if [ -z "$CREATED_ID" ] || [ "$CREATED_ID" = "null" ]; then
        echo -e "${RED}Failed to create product $i: $RESP${NC}"
    else
        CREATED_PRODUCT_IDS+=("$CREATED_ID")
    fi
done
info "Created ${#CREATED_PRODUCT_IDS[@]} products."

# ── 4. Create 100 published blog posts ───────────────────────────────────────
info "Creating 100 test blog posts..."
for i in $(seq 1 100); do
    RESP=$($CURL -X POST "$BASE_URL/api/admin/blog" \
        -H "Authorization: Bearer ${TOKEN:-}" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"Test Post $i\",
            \"title_ro\": \"Post Test $i\",
            \"blog_id\": \"test-post-$(printf '%03d' $i)\",
            \"content_markdown\": \"Content for post $i.\",
            \"content_markdown_ro\": \"Continut pentru postarea $i.\",
            \"excerpt\": \"Excerpt $i\",
            \"excerpt_ro\": \"Rezumat $i\",
            \"author\": \"Test Author\",
            \"is_published\": true
        }")
    CREATED_ID=$(echo "$RESP" | jq -r '.id' 2>/dev/null)
    if [ -z "$CREATED_ID" ] || [ "$CREATED_ID" = "null" ]; then
        echo -e "${RED}Failed to create blog post $i: $RESP${NC}"
    else
        CREATED_BLOG_IDS+=("$CREATED_ID")
    fi
done
info "Created ${#CREATED_BLOG_IDS[@]} blog posts."
echo ""

# ── 5. Pagination tests ────────────────────────────────────────────────────────
info "=== PRODUCTS (200 seeded, max per_page=100) ==="
# 200 products: 10 full pages of 20
check_count  "default (page=1, per_page=20) → 20"    20  "$BASE_URL/api/products"
check_count  "page=10&per_page=20 → 20"               20  "$BASE_URL/api/products?page=10&per_page=20"
check_empty  "page=11&per_page=20 → 0"                    "$BASE_URL/api/products?page=11&per_page=20"
# 200 products: 2 full pages of 100
check_count  "page=1&per_page=100 → 100"             100  "$BASE_URL/api/products?page=1&per_page=100"
check_count  "page=2&per_page=100 → 100"             100  "$BASE_URL/api/products?page=2&per_page=100"
check_empty  "page=3&per_page=100 → 0"                    "$BASE_URL/api/products?page=3&per_page=100"
# cap enforcement
check_count  "per_page=200 capped → 100"             100  "$BASE_URL/api/products?per_page=200"
check_count  "in_stock=true page=1 → 20"              20  "$BASE_URL/api/products?in_stock=true&per_page=20"
echo ""

info "=== BLOG (100 seeded, max per_page=50) ==="
# 100 posts: 10 full pages of 10
check_count  "default (page=1, per_page=10) → 10"    10  "$BASE_URL/api/blog"
check_count  "page=10&per_page=10 → 10"               10  "$BASE_URL/api/blog?page=10&per_page=10"
check_empty  "page=11&per_page=10 → 0"                    "$BASE_URL/api/blog?page=11&per_page=10"
# 100 posts: 2 full pages of 50
check_count  "page=1&per_page=50 → 50"                50  "$BASE_URL/api/blog?page=1&per_page=50"
check_count  "page=2&per_page=50 → 50"                50  "$BASE_URL/api/blog?page=2&per_page=50"
check_empty  "page=3&per_page=50 → 0"                     "$BASE_URL/api/blog?page=3&per_page=50"
# cap enforcement
check_count  "per_page=200 capped → 50"               50  "$BASE_URL/api/blog?per_page=200"
echo ""

info "=== ADMIN BLOG (requires auth, 100 seeded) ==="
check_auth_count() {
    local desc="$1" expected="$2" url="$3"
    local actual
    actual=$($CURL -H "Authorization: Bearer ${TOKEN:-}" "$url" | jq 'length' 2>/dev/null || echo "-1")
    if [ "$actual" -eq "$expected" ]; then
        pass "$desc (got $actual)"
    else
        fail "$desc (expected $expected, got $actual)"
    fi
}

check_auth_count "admin page=1&per_page=50 → 50"  50 "$BASE_URL/api/admin/blog/admin?page=1&per_page=50"
check_auth_count "admin page=2&per_page=50 → 50"  50 "$BASE_URL/api/admin/blog/admin?page=2&per_page=50"
check_auth_count "admin page=3&per_page=50 → 0"   0  "$BASE_URL/api/admin/blog/admin?page=3&per_page=50"
check_auth_count "admin page=1&per_page=10 → 10"  10 "$BASE_URL/api/admin/blog/admin?page=1&per_page=10"
check_auth_count "admin page=10&per_page=10 → 10" 10 "$BASE_URL/api/admin/blog/admin?page=10&per_page=10"
check_auth_count "admin page=11&per_page=10 → 0"  0  "$BASE_URL/api/admin/blog/admin?page=11&per_page=10"

echo ""

# ── 6. Summary ────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo -e "Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
rm -f /tmp/test_pagination_img.png
