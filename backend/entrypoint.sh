#!/bin/sh

# Wait for database to be ready
echo "Waiting for postgres..."
while ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER; do
  sleep 1
done
echo "PostgreSQL started"

# Create the database (if missing) AND run migrations
# 'diesel setup' does both. 'diesel migration run' only runs migrations.
echo "Setting up database..."
diesel setup

# Add admin user
echo "Adding admin user..."
./add_admin_user $ADMIN_USERNAME $ADMIN_PASSWORD 

# Start the server
echo "Starting server..."
./backend
