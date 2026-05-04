# Stage 1: Build
FROM node:20.20.2-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_SITE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN ls -l /app/dist

# Stage 2: Production
# fholzer/nginx-brotli is Alpine-based and ships ngx_brotli statically built
# alongside upstream nginx. Tag tracks the upstream nginx version.
FROM fholzer/nginx-brotli:v1.30.0

# Tools needed by the sitemap generator
RUN apk add --no-cache curl jq tzdata

# supercronic — a cron implementation that runs as a non-root user, unlike
# busybox crond. Pinned version + SHA1 from the upstream release notes:
#   https://github.com/aptible/supercronic/releases
ARG SUPERCRONIC_VERSION=0.2.29
ARG SUPERCRONIC_SHA1SUM=cd48d45c4b10f3f0bfdd3a57d054cd05ac96812b
ARG SUPERCRONIC_ARCH=amd64
RUN curl -fsSLO "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-${SUPERCRONIC_ARCH}" \
 && echo "${SUPERCRONIC_SHA1SUM}  supercronic-linux-${SUPERCRONIC_ARCH}" | sha1sum -c - \
 && mv "supercronic-linux-${SUPERCRONIC_ARCH}" /usr/local/bin/supercronic \
 && chmod +x /usr/local/bin/supercronic

# Built application + nginx config
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf

# Sitemap generator + container entrypoint
COPY generate-sitemap.sh /usr/local/bin/generate-sitemap.sh
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/generate-sitemap.sh /usr/local/bin/docker-entrypoint.sh

# Crontab read by supercronic. Standard 5-field crontab format; supercronic
# captures each job's stdout/stderr and forwards it through its own logger,
# so no per-line redirect is needed.
RUN mkdir -p /etc/supercronic && \
    printf '*/10 * * * * /usr/local/bin/generate-sitemap.sh\n' > /etc/supercronic/crontab

# nginx pid file, cache dirs, and webroot must be writable by the nginx worker
RUN mkdir -p /var/cache/nginx /var/run /run && \
    chown -R nginx:nginx /var/cache/nginx /var/run /run /usr/share/nginx/html

USER nginx

# fholzer/nginx-brotli sets ENTRYPOINT to nginx; override so our entrypoint
# script (which itself execs nginx) becomes the container command.
ENTRYPOINT []
CMD ["/usr/local/bin/docker-entrypoint.sh"]
