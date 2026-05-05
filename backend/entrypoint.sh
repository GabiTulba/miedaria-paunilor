#!/bin/sh

# Wait for database to be ready
echo "Waiting for postgres..."
while ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER; do
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

# Add admin user
echo "Adding admin user..."
./add_admin_user $ADMIN_USERNAME $ADMIN_PASSWORD

# Drop privileges and exec server as appuser (PID 1, proper signal handling)
echo "Starting server..."
exec ./backend
