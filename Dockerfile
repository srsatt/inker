# All-in-one Dockerfile for Inker
# Bundles frontend build and Bun/Nest backend. SQLite is stored in /app/data.

FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY frontend/ .
RUN bun run build

FROM oven/bun:1-slim AS backend-install

WORKDIR /app

COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock* ./
COPY backend/prisma ./prisma/

RUN bun install --frozen-lockfile && \
    node ./node_modules/prisma/build/index.js generate && \
    cp -r node_modules/.prisma /tmp/.prisma && \
    rm -rf node_modules && \
    bun install --production --frozen-lockfile && \
    cp -r /tmp/.prisma node_modules/.prisma && \
    rm -rf /tmp/.prisma \
    node_modules/typescript \
    node_modules/@types

FROM oven/bun:1-slim AS backend-builder

WORKDIR /app

COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY backend/prisma ./prisma/
RUN node ./node_modules/prisma/build/index.js generate

COPY backend/ .
RUN bun run build

FROM debian:trixie-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates openssl unzip \
    fonts-liberation fonts-noto-color-emoji fonts-noto-cjk fontconfig \
    libnss3 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 \
    libgbm1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libasound2t64 libcups2t64 libatk1.0-0t64 libnspr4 libdbus-1-3 \
    && CHROME_VERSION=$(wget -qO- "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_STABLE") \
    && wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-headless-shell-linux64.zip" -O /tmp/chrome.zip \
    && unzip /tmp/chrome.zip -d /opt/ \
    && chmod +x /opt/chrome-headless-shell-linux64/chrome-headless-shell \
    && rm /tmp/chrome.zip \
    && apt-get purge -y unzip wget \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc /usr/share/man /usr/share/info

COPY --from=oven/bun:1-slim /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node

ENV PUPPETEER_EXECUTABLE_PATH=/opt/chrome-headless-shell-linux64/chrome-headless-shell
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3337
ENV DATABASE_URL=file:../data/inker.db
ENV ADMIN_PIN=1111
ENV CORS_ORIGINS=*
ENV LOG_LEVEL=info

WORKDIR /app

COPY --from=backend-install /app/node_modules ./node_modules
COPY backend/prisma ./prisma/
COPY --from=backend-install /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-install /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=backend-builder /app/dist ./dist
COPY backend/package.json ./
COPY backend/assets ./assets
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=frontend-builder /app/dist ./frontend/dist

RUN mkdir -p /app/data /app/uploads/screens /app/uploads/firmware /app/uploads/widgets \
    /app/uploads/captures /app/uploads/drawings /app/logs /tmp/inker-home && \
    useradd --system --no-create-home --shell /usr/sbin/nologin inker && \
    chown -R inker:inker /app /tmp/inker-home && \
    chmod +x /app/docker-entrypoint.sh

USER inker
ENV HOME=/tmp/inker-home

EXPOSE 3337

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD bun -e "const r=await fetch('http://127.0.0.1:3337/health');process.exit(r.ok?0:1)" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "dist/main.js"]
