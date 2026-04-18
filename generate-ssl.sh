#!/bin/bash

# Generate SSL certificates for development
# For production, use certificates from a trusted CA like Let's Encrypt

echo "Generating self-signed SSL certificates for development..."

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate private key and certificate (ECDSA P-384, 90-day expiry, SAN required by modern browsers)
openssl req -x509 -nodes -days 90 -newkey ec -pkeyopt ec_paramgen_curve:P-384 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=RO/ST=Bucharest/L=Bucharest/O=Miedaria Paunilor/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Set proper permissions (644 allows nginx non-root user to read key in container)
chmod 644 ssl/cert.pem
chmod 644 ssl/key.pem

echo "SSL certificates generated successfully!"
echo "Certificate: ssl/cert.pem"
echo "Private key: ssl/key.pem"
echo ""
echo "For production use, replace these with certificates from a trusted CA."
echo "You can obtain free certificates from Let's Encrypt using certbot."