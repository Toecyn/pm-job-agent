# Multi-stage build for the PM Job Search & Application Agent.
# Ships with the default SQLite datastore (see ARCHITECTURE.md §5) so the
# container is genuinely self-contained — no external database required.

FROM node:20-bookworm-slim AS base
# better-sqlite3 needs build tools to compile its native binding; Playwright
# needs the same base OS libraries as the browsers it will download.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/prod.db"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts

# Persistent volume for the SQLite database and any locally-saved automation
# screenshots — see docker-compose.yml.
VOLUME ["/data"]
RUN mkdir -p /data screenshots/agent-runs

EXPOSE 3000

# Browser automation (brief §15) is opt-in and NOT installed in this image by
# default — Chromium + its OS deps add several hundred MB and most users
# will run in REVIEW/MANUAL mode without ever needing it. To enable it:
#   RUN npx playwright install --with-deps chromium
# then set AUTOMATION_ENABLED=true at runtime.

# Apply migrations, then start the server. `prisma migrate deploy` is safe
# to run on every boot — it's a no-op once the schema is already current.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
