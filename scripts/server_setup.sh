#!/bin/bash
# Sets up a server (Debian/Ubuntu, Docker already installed) to run this
# checkout. Run as root from the repository, after writing `.env`:
#
#   scripts/server_setup.sh <email for Let's Encrypt notices>
#
# It installs:
#   * miedaria-paunilor.service: builds and starts the stack at boot;
#   * a Let's Encrypt certificate for the domains of `.env`'s MODE, with a new
#     certificate and key on the 1st of every month;
#   * a weekly apt update, upgrade and reboot (Sunday 04:47, server time).
# Running it again is safe: it only replaces what it installed.
set -euo pipefail

LE_EMAIL="${1:-}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE=miedaria-paunilor
CERT_NAME=miedaria-paunilor
INSTALL_CERT=/usr/local/sbin/miedaria-paunilor-install-cert
MAINTENANCE=/usr/local/sbin/weekly-maintenance
NGINX_GID=101 # the nginx user inside the frontend container

fail() {
    echo "server_setup: $*" >&2
    exit 1
}

[[ $EUID -eq 0 ]] || fail "run as root"
[[ -n "$LE_EMAIL" ]] || fail "usage: $0 <email for Let's Encrypt notices>"
[[ -f "$REPO_DIR/.env" ]] || fail "$REPO_DIR/.env is missing; copy env.sample and fill it in first"
docker compose version >/dev/null 2>&1 || fail "Docker with the compose plugin must be installed"
if ! grep -q "acme-challenge" "$REPO_DIR/frontend/nginx.conf" || ! grep -q "/var/www/acme" "$REPO_DIR/docker-compose.yml"; then
    fail "this checkout's nginx does not serve Let's Encrypt challenges; update it (git pull) first"
fi

MODE="$(sed -n 's/^MODE=//p' "$REPO_DIR/.env" | tail -n 1 | tr -d "\"' \r")"
case "$MODE" in
    prod) DOMAINS=(miedaria-paunilor.ro www.miedaria-paunilor.ro) ;;
    dev) DOMAINS=(dev.miedaria-paunilor.ro www.dev.miedaria-paunilor.ro) ;;
    *) fail "MODE in .env must be dev or prod, not '$MODE'" ;;
esac

echo "== Packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y certbot cron curl openssl
systemctl enable --now cron
# The monthly cron job below replaces certbot's own renewal timer.
systemctl disable --now certbot.timer 2>/dev/null || true

echo "== Certificate folders"
install -d -m 755 "$REPO_DIR/ssl" "$REPO_DIR/acme"
if [[ ! -f "$REPO_DIR/ssl/cert.pem" || ! -f "$REPO_DIR/ssl/key.pem" ]]; then
    # nginx cannot start without a certificate; this placeholder lets it serve
    # the Let's Encrypt challenge that replaces it a minute later.
    openssl req -x509 -nodes -days 7 -newkey ec -pkeyopt ec_paramgen_curve:P-384 \
        -keyout "$REPO_DIR/ssl/key.pem" -out "$REPO_DIR/ssl/cert.pem" \
        -subj "/CN=${DOMAINS[0]}" -addext "subjectAltName=DNS:${DOMAINS[0]}" 2>/dev/null
    chown root:"$NGINX_GID" "$REPO_DIR/ssl/key.pem"
    chmod 640 "$REPO_DIR/ssl/key.pem"
    chmod 644 "$REPO_DIR/ssl/cert.pem"
fi

echo "== Certificate install hook"
cat >"$INSTALL_CERT" <<EOF
#!/bin/sh
# certbot deploy hook: copies a new certificate into the site's ssl/ folder
# and reloads nginx. Installed by scripts/server_setup.sh.
set -eu
LINEAGE="\${RENEWED_LINEAGE:-/etc/letsencrypt/live/$CERT_NAME}"
install -m 644 -o root -g root "\$LINEAGE/fullchain.pem" "$REPO_DIR/ssl/cert.pem"
install -m 640 -o root -g $NGINX_GID "\$LINEAGE/privkey.pem" "$REPO_DIR/ssl/key.pem"
cd "$REPO_DIR"
docker compose exec -T frontend nginx -s reload \\
    || echo "frontend not running; it loads the certificate when it starts" >&2
EOF
chmod 755 "$INSTALL_CERT"

echo "== systemd service"
cat >"/etc/systemd/system/$SERVICE.service" <<EOF
[Unit]
Description=Miedăria Păunilor (docker compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/docker compose up -d --build --remove-orphans
ExecStop=/usr/bin/docker compose down
# The first build compiles the Rust backend from scratch.
TimeoutStartSec=3600

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE.service"
echo "Building and starting the stack (the first build takes a while)..."
systemctl restart "$SERVICE.service"

echo "== Let's Encrypt certificate for ${DOMAINS[*]}"
for _ in $(seq 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/.well-known/acme-challenge/probe || true)"
    [[ "$code" == 404 ]] && break
    sleep 2
done
[[ "$code" == 404 ]] || fail "nginx does not answer on port 80; check 'docker compose logs frontend'"
domain_args=()
for domain in "${DOMAINS[@]}"; do domain_args+=(-d "$domain"); done
certbot certonly --webroot -w "$REPO_DIR/acme" "${domain_args[@]}" \
    --cert-name "$CERT_NAME" --key-type ecdsa \
    --non-interactive --agree-tos -m "$LE_EMAIL" \
    --keep-until-expiring --expand --deploy-hook "$INSTALL_CERT"
# Covers a certificate that already existed, which certbot leaves alone.
"$INSTALL_CERT"

echo "== Weekly maintenance"
cat >"$MAINTENANCE" <<'EOF'
#!/bin/sh
# Weekly: update and upgrade packages, then reboot. The site comes back
# through its systemd service. Installed by scripts/server_setup.sh.
exec >>/var/log/weekly-maintenance.log 2>&1
echo "== $(date -Is)"
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade \
    || echo "upgrade failed; rebooting anyway"
systemctl reboot
EOF
chmod 755 "$MAINTENANCE"

echo "== Cron jobs"
cat >/etc/cron.d/miedaria-paunilor <<EOF
# Installed by scripts/server_setup.sh (times are the server's time zone).
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 1st of every month: a new Let's Encrypt certificate and key.
17 3 1 * * root certbot renew --cert-name $CERT_NAME --force-renewal --quiet

# Sunday: apt update, apt upgrade, reboot.
47 4 * * 0 root $MAINTENANCE
EOF
chmod 644 /etc/cron.d/miedaria-paunilor

echo "Done: $SERVICE.service is running with a Let's Encrypt certificate for ${DOMAINS[*]}."
