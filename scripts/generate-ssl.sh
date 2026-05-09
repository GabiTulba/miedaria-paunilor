#!/bin/bash

# Generate SSL certificates for development
# For production, use certificates from a trusted CA like Let's Encrypt

echo "Generating self-signed SSL certificates for development..."

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate private key and certificate (ECDSA P-384, 365-day expiry, SAN required by modern browsers)
openssl req -x509 -nodes -days 365 -newkey ec -pkeyopt ec_paramgen_curve:P-384 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=RO/ST=Bucharest/L=Bucharest/O=Miedaria Paunilor/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Cert is fine to be world-readable; private key must NOT be world-readable.
# The frontend container runs nginx as the `nginx` user (uid 101) and bind-
# mounts this directory. To make the key readable by container nginx without
# falling back to 644 (the audit's main concern), we chmod 640 and chgrp it
# to gid 101. If sudo is unavailable, we fall back to 644 with a warning so
# `docker compose up` still works on the developer's first run.
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem
if sudo -n chown "$(id -u)":101 ssl/key.pem 2>/dev/null && sudo -n chmod 640 ssl/key.pem 2>/dev/null; then
    echo "ssl/key.pem set to 640, group=101 (container nginx readable)"
elif chown "$(id -u)":101 ssl/key.pem 2>/dev/null && chmod 640 ssl/key.pem 2>/dev/null; then
    echo "ssl/key.pem set to 640, group=101 (container nginx readable)"
else
    chmod 644 ssl/key.pem
    cat >&2 <<'WARN'
WARN: could not chgrp ssl/key.pem to gid 101; falling back to mode 644.
      To restore the audit-compliant 640 setting, run:
        sudo chgrp 101 ssl/key.pem && sudo chmod 640 ssl/key.pem
WARN
fi

echo "SSL certificates generated successfully!"
echo "Certificate: ssl/cert.pem"
echo "Private key: ssl/key.pem"
echo ""
echo "For production use, replace these with certificates from a trusted CA."
echo "You can obtain free certificates from Let's Encrypt using certbot."