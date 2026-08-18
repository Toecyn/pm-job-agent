/**
 * Vitest global setup — runs once for the whole test run (in the main
 * process, before any test file/worker starts), not per file. Spins up a
 * real, ephemeral Postgres instance via `embedded-postgres` (no Docker, no
 * external service — works on Windows/macOS/Linux) and applies migrations
 * to it, so the suite exercises real Postgres behavior identically to
 * production rather than mocking the database layer.
 *
 * Uses a fixed, test-only port/database so it never collides with the
 * `npm run db:local-postgres` dev instance (different port) or a real
 * dev/production database.
 */
import path from "node:path"
import fs from "node:fs"
import { execSync } from "node:child_process"
import EmbeddedPostgres from "embedded-postgres"

export const TEST_PORT = 54328
export const TEST_USER = "test"
export const TEST_PASSWORD = "test"
export const TEST_DATABASE = "pmjobagent_test"
export const TEST_DATABASE_URL = `postgresql://${TEST_USER}:${TEST_PASSWORD}@localhost:${TEST_PORT}/${TEST_DATABASE}`

const DATA_DIR = path.join(__dirname, "..", "..", ".test-postgres-data")

let pg: EmbeddedPostgres | undefined

export async function setup() {
  // Clean slate every run — this instance is meant to be fully disposable.
  fs.rmSync(DATA_DIR, { recursive: true, force: true })

  pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: TEST_PORT,
    user: TEST_USER,
    password: TEST_PASSWORD,
    persistent: false,
    onLog: () => {}, // silence Postgres's own stdout — keep test output readable
    onError: (err) => console.error("[test-postgres]", err),
  })

  await pg.initialise()
  await pg.start()
  await pg.createDatabase(TEST_DATABASE)

  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  })
}

export async function teardown() {
  await pg?.stop() // persistent: false — this also removes the data directory's contents
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
}
