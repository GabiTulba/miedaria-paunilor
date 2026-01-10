#!/bin/sh

# Simple sitemap generator for frontend container
# Runs inside Docker container, generates sitemap.xml in nginx web root

set -e

# Configuration - inside Docker container
BACKEND_URL="http://backend:8000"
SITEMAP_OUTPUT="/usr/share/nginx/html/sitemap.xml"
TEMP_FILE="/tmp/sitemap.xml"

# Generate sitemap
echo "Generating sitemap from $BACKEND_URL..."

# Fetch data from backend
if ! response=$(curl -s -f "$BACKEND_URL/api/sitemap-data"); then
    echo "Error: Failed to fetch sitemap data from backend"
    exit 1
fi

# Generate XML
cat > "$TEMP_FILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
EOF

# Add all URLs from the response
echo "$response" | jq -r '.static_urls[], .product_urls[], .blog_urls[] | "    <url>\n        <loc>\(.loc)</loc>\n        <lastmod>\(.lastmod)</lastmod>\n        <changefreq>\(.changefreq)</changefreq>\n        <priority>\(.priority)</priority>\n    </url>"' >> "$TEMP_FILE"

echo '</urlset>' >> "$TEMP_FILE"

# Move to final location
mv "$TEMP_FILE" "$SITEMAP_OUTPUT"

# Count URLs for logging
static_count=$(echo "$response" | jq '.static_urls | length')
product_count=$(echo "$response" | jq '.product_urls | length')
blog_count=$(echo "$response" | jq '.blog_urls | length')
total_count=$((static_count + product_count + blog_count))

echo "Sitemap generated: $total_count URLs ($static_count static, $product_count products, $blog_count blog posts)"
echo "Sitemap saved to: $SITEMAP_OUTPUT"