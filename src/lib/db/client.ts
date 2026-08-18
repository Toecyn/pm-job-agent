import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Prisma ORM 7 requires an explicit driver adapter at runtime (the old
// bundled query-engine-binary connection string approach was removed — see
// prisma.config.ts). PostgreSQL is required here rather than optional：
// serverless hosts like Vercel have a read-only, ephemeral filesystem, so a
// file-based database (the project's original SQLite default) cannot work
// there — see ARCHITECTURE.md §5.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a PostgreSQL connection string — see .env.example and ARCHITECTURE.md §5."
    )
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
