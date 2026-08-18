# Multi-stage build for the PM Job Search & Application Agent.
# Uses PostgreSQL (see ARCHITECTURE.md §5) — docker-compose.yml runs a
# `postgres` service alongside this image; set DATABASE_URL to point at any
# other Postgres instance if you're not using compose.

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No DATABASE_URL needed here — `prisma generate` only reads the schema
# file, and every page that queries the database is marked
# `dynamic = "force-dynamic"`, so `next build` never touches a real DB.
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts

# Persistent volume for locally-saved automation screenshots only — the
# database itself lives in Postgres, not on this container's disk.
VOLUME ["/app/screenshots"]
RUN mkdir -p screenshots/agent-runs

EXPOSE 3000

# Browser automation (brief §15) is opt-in and NOT installed in this image by
# default — Chromium + its OS deps add several hundred MB and most users
# will run in REVIEW/MANUAL mode without ever needing it. To enable it:
#   RUN npx playwright install --with-deps chromium
# then set AUTOMATION_ENABLED=true at runtime.

# Apply migrations, then start the server. `prisma migrate deploy` is safe
# to run on every boot — it's a no-op once the schema is already current.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
