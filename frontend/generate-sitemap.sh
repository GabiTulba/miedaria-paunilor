#!/bin/sh

# Generates sitemap.xml in the nginx web root from data fetched at runtime
# from the backend's /api/sitemap-data endpoint.

set -e
PATH=/usr/local/bin:/usr/bin:/bin

BACKEND_URL="http://backend:8000"
SITEMAP_OUTPUT="/usr/share/nginx/html/sitemap.xml"
TEMP_FILE="/tmp/sitemap.xml"

echo "[$(date -Is)] Generating sitemap from $BACKEND_URL..."

if ! response=$(curl -s -f "$BACKEND_URL/api/sitemap-data"); then
    echo "Error: Failed to fetch sitemap data from backend"
    exit 1
fi

cat > "$TEMP_FILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">
EOF

# One <url> per entry; emit <image:image> children for any URL that carries
# images (products today, anything else in the future). jq builds the inner
# <image:image> block by joining the per-URL image array with newlines.
echo "$response" | jq -r '
    [.static_urls[], .product_urls[], .blog_urls[]] | .[] |
    "  <url>\n    <loc>\(.loc)</loc>\n    <lastmod>\(.lastmod)</lastmod>" +
    ((.images // []) | map("\n    <image:image>\n      <image:loc>\(.)</image:loc>\n    </image:image>") | join("")) +
    "\n  </url>"
' >> "$TEMP_FILE"

echo '</urlset>' >> "$TEMP_FILE"

mv "$TEMP_FILE" "$SITEMAP_OUTPUT"

static_count=$(echo "$response" | jq '.static_urls | length')
product_count=$(echo "$response" | jq '.product_urls | length')
blog_count=$(echo "$response" | jq '.blog_urls | length')
total_count=$((static_count + product_count + blog_count))

echo "Sitemap generated: $total_count URLs ($static_count static, $product_count products, $blog_count blog posts)"
echo "Sitemap saved to: $SITEMAP_OUTPUT"
