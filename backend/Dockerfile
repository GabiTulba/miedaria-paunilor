# Stage 1: Builder
FROM rust:1.95.0 AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y openssl libpq-dev

COPY Cargo.toml Cargo.lock ./
COPY diesel.toml ./
COPY ./migrations ./migrations


# This build step is to cache dependencies for the main binary and diesel-cli
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    mkdir -p src/bin && echo "fn main() {}" > src/bin/add_admin_user.rs
RUN cargo build --release

# Build diesel-cli
RUN cargo install diesel_cli --no-default-features --features postgres --root /usr/local

# Copy the rest of the source code
COPY src ./src

# Build both binaries
RUN cargo build --release


# Stage 2: Runner
# Use the same base image as rust:latest to ensure GLIBC compatibility.
# rust:latest is currently based on debian:trixie-slim (Debian 13)
FROM debian:trixie-slim

# Install runtime dependencies
# postgresql-client for pg_isready, openssl and libpq-dev for the Rust app runtime
RUN apt-get update && \
    apt-get install -y openssl libpq-dev ca-certificates postgresql-client gosu && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/false appuser

WORKDIR /app

# Copy the built binaries from the builder stage
COPY --from=builder /app/target/release/backend .
COPY --from=builder /app/target/release/add_admin_user .

# Copy diesel-cli
COPY --from=builder /usr/local/bin/diesel /usr/local/bin/

# Copy the migrations folder so diesel can run them
COPY --from=builder /app/migrations ./migrations

# Copy the diesel config so diesel knows where the project root is
COPY --from=builder /app/diesel.toml .

# Copy entrypoint script
COPY entrypoint.sh .

# Set permissions and create image upload directory
RUN chmod +x entrypoint.sh && \
    mkdir -p /app/images && \
    chown -R appuser:appuser /app

USER appuser

# Expose port
EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["./entrypoint.sh"]
