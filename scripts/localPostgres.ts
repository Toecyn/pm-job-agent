/**
 * Zero-install local Postgres for development (brief §31 "runnable
 * locally" — now that a real database is required for serverless hosting,
 * see ARCHITECTURE.md §5, this replaces the old SQLite-file convenience).
 * Downloads and runs a real Postgres binary via the `embedded-postgres`
 * devDependency — no Docker, no hosted account needed for local dev.
 *
 * Usage:
 *   npm run db:local-postgres
 * Leave it running in its own terminal; it prints the DATABASE_URL to put
 * in your .env. Data persists in .local-postgres/ between runs. Ctrl+C
 * shuts it down cleanly (data is kept — this is NOT the same instance the
 * test suite uses, which is ephemeral).
 */
import path from "node:path"
import EmbeddedPostgres from "embedded-postgres"

const PORT = 54327
const USER = "pmjobagent"
const PASSWORD = "pmjobagent"
const DATABASE = "pmjobagent"
const DATA_DIR = path.join(process.cwd(), ".local-postgres")

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
  })

  const alreadyInitialised = await import("node:fs").then((fs) => fs.existsSync(path.join(DATA_DIR, "PG_VERSION")))
  if (!alreadyInitialised) {
    console.log("Initializing local Postgres data directory...")
    await pg.initialise()
  }

  await pg.start()

  try {
    await pg.createDatabase(DATABASE)
  } catch {
    // already exists — fine
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`
  console.log("\nLocal Postgres is running.")
  console.log(`Set this in your .env:\n  DATABASE_URL="${url}"\n`)
  console.log("Press Ctrl+C to stop.")

  const shutdown = async () => {
    console.log("\nStopping local Postgres...")
    await pg.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((err) => {
  console.error("Failed to start local Postgres:", err)
  process.exit(1)
})
