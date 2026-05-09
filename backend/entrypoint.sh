#!/bin/sh
set -eu

# Wait for database to be ready
echo "Waiting for postgres..."
while ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
  sleep 1
done
echo "PostgreSQL started"

# Create the database if missing, then apply any pending migrations.
# `diesel setup` only runs migrations on first DB creation, so we follow up
# with `migration run` so subsequent deploys pick up new migrations.
echo "Setting up database..."
diesel setup
echo "Running pending migrations..."
diesel migration run

# Add admin user. add_admin_user is expected to be idempotent — it returns 0 if
# the user already exists. With `set -e`, a non-zero exit aborts the container
# instead of starting the API in a half-initialized state.
echo "Adding admin user..."
./add_admin_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD"

echo "Starting server..."
exec ./backend
