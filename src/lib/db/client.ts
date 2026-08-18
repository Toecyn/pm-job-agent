import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

// Prisma ORM 7 requires an explicit driver adapter at runtime (the old
// bundled query-engine-binary connection string approach was removed — see
// prisma.config.ts and ARCHITECTURE.md §5). Swapping to Postgres in
// production means swapping this adapter for @prisma/adapter-pg alongside
// the schema.prisma provider change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
