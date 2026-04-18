# Stage 1: Build
FROM node:20.20.2-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN ls -l /app/dist

# Stage 2: Production
FROM nginx:1.30.0-alpine

# Install cron and dependencies for sitemap generation
RUN apk add --no-cache curl jq tzdata

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy sitemap generation script
COPY generate-sitemap.sh /usr/local/bin/generate-sitemap.sh
RUN chmod +x /usr/local/bin/generate-sitemap.sh

# Create crontab for nginx user (not root); truncate log daily to prevent unbounded growth
RUN printf '*/10 * * * * /usr/local/bin/generate-sitemap.sh >> /var/log/sitemap-cron.log 2>&1\n0 0 * * * truncate -s 0 /var/log/sitemap-cron.log\n' > /etc/crontabs/nginx

# Create log file owned by nginx user
RUN touch /var/log/sitemap-cron.log && chown nginx:nginx /var/log/sitemap-cron.log

# nginx pid file and cache dirs must be writable by nginx user
RUN mkdir -p /var/cache/nginx /var/run /run && \
    chown -R nginx:nginx /var/cache/nginx /var/run /run /usr/share/nginx/html

USER nginx

# Start cron in background and nginx in foreground
CMD sh -c "crond && nginx -g 'daemon off;'"
