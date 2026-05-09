#!/bin/sh
set -e

# Generate a fresh sitemap once at startup so a new container doesn't serve
# the stale baked sitemap for up to 10 minutes. Failures are non-fatal — the
# static sitemap remains as fallback and supercronic will retry on schedule.
if ! /usr/local/bin/generate-sitemap.sh; then
  echo "[entrypoint] WARN: initial sitemap generation failed; cron will retry" >&2
fi

# supercronic runs jobs as the current (nginx) user; output goes to stderr in
# structured form and is picked up by Docker's logging driver.
supercronic /etc/supercronic/crontab &

exec nginx -g 'daemon off;'
