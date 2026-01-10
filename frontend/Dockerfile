# Stage 1: Build
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN ls -l /app/dist

# Stage 2: Production
FROM nginx:stable-alpine

# Install cron and dependencies for sitemap generation
RUN apk add --no-cache curl jq tzdata

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy sitemap generation script
COPY generate-sitemap.sh /usr/local/bin/generate-sitemap.sh
RUN chmod +x /usr/local/bin/generate-sitemap.sh

# Create cron job for sitemap generation (every 10 minutes)
RUN echo "*/10 * * * * /usr/local/bin/generate-sitemap.sh >> /var/log/sitemap-cron.log 2>&1" > /etc/crontabs/root

# Create log file
RUN touch /var/log/sitemap-cron.log

# Start cron in background and nginx in foreground
CMD sh -c "crond && nginx -g 'daemon off;'"
