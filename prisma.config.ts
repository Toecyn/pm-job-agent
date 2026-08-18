// Prisma ORM 7 config file — replaces the datasource `url` that used to live
// directly in schema.prisma (see prisma/schema.prisma header note and
// ARCHITECTURE.md §5 for why SQLite is the default local datastore).
import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})
