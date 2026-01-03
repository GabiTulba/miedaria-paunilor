#!/bin/bash

# Generate SSL certificates for development
# For production, use certificates from a trusted CA like Let's Encrypt

echo "Generating self-signed SSL certificates for development..."

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=RO/ST=Bucharest/L=Bucharest/O=Miedaria Paunilor/CN=localhost"

# Set proper permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem

echo "SSL certificates generated successfully!"
echo "Certificate: ssl/cert.pem"
echo "Private key: ssl/key.pem"
echo ""
echo "For production use, replace these with certificates from a trusted CA."
echo "You can obtain free certificates from Let's Encrypt using certbot."