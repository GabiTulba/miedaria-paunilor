#!/bin/bash

# Script to check sitemap cron job logs

echo "=== Checking sitemap cron job status ==="
echo ""

# Check if cron is running
echo "1. Checking if cron is running in frontend container:"
if docker-compose exec frontend ps aux | grep -q "[c]rond"; then
    echo "   ✓ Cron is running"
else
    echo "   ✗ Cron is NOT running"
fi

echo ""

# Check cron log file
echo "2. Checking cron job log file:"
if docker-compose exec frontend test -f /var/log/sitemap-cron.log; then
    echo "   Log file exists"
    log_size=$(docker-compose exec frontend stat -c%s /var/log/sitemap-cron.log 2>/dev/null || echo "0")
    if [ "$log_size" -gt 0 ]; then
        echo "   Log file size: ${log_size} bytes"
        echo ""
        echo "   Last 5 log entries:"
        docker-compose exec frontend tail -5 /var/log/sitemap-cron.log 2>/dev/null || echo "   (empty or error reading)"
    else
        echo "   Log file is empty (cron may not have run yet)"
    fi
else
    echo "   Log file does not exist"
fi

echo ""

# Check current sitemap
echo "3. Checking current sitemap:"
if docker-compose exec frontend test -f /usr/share/nginx/html/sitemap.xml; then
    echo "   Sitemap exists at /usr/share/nginx/html/sitemap.xml"
    url_count=$(docker-compose exec frontend grep -c "<url>" /usr/share/nginx/html/sitemap.xml 2>/dev/null || echo "0")
    echo "   Contains $url_count URLs"
    
    echo ""
    echo "   Sample of sitemap content:"
    docker-compose exec frontend head -20 /usr/share/nginx/html/sitemap.xml 2>/dev/null | sed 's/^/   /'
else
    echo "   Sitemap file not found!"
fi

echo ""
echo "=== Quick commands ==="
echo "To view all logs: docker-compose logs frontend"
echo "To view cron log: docker-compose exec frontend cat /var/log/sitemap-cron.log"
echo "To run manually: docker-compose exec frontend /usr/local/bin/generate-sitemap.sh"
echo "To check via web: curl -k https://localhost/sitemap.xml | head -20"