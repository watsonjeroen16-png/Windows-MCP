# syntax=docker/dockerfile:1

# ---- Build stage: install all deps (incl. dev) and compile TypeScript ----
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  # tsc only emits .js — the migration runner reads its .sql files from disk
  # at runtime (src/db/migrate.ts resolves MIGRATIONS_DIR next to itself), so
  # copy them alongside the compiled dist/db/migrate.js.
  && cp -r src/db/migrations dist/db/migrations

# ---- Production stage: prod-only deps + compiled output, non-root user ----
FROM node:20-slim AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN groupadd --system --gid 1001 kaizi \
  && useradd --system --uid 1001 --gid kaizi --home-dir /app --shell /usr/sbin/nologin kaizi \
  && chown -R kaizi:kaizi /app

USER kaizi

EXPOSE 4000

# `node dist/db/migrate.js` (same image) applies migrations — see
# ../docker-compose.yml for the one-shot migrate service that runs it before
# the app container starts.
CMD ["node", "dist/index.js"]
