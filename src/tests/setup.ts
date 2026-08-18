import { execSync } from "node:child_process"
import path from "node:path"
import fs from "node:fs"
import { beforeEach } from "vitest"

// Hermetic test environment — deliberately does NOT load the developer's
// .env, so tests never depend on (or clobber) real local settings like
// MOCK_SOURCE_ENABLED or a configured AI provider.
const TEST_DB_PATH = path.join(__dirname, "..", "..", "prisma", "test.db")
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
process.env.NEXTAUTH_SECRET = "test-secret"
process.env.AUTH_USER_EMAIL = "test@example.com"
process.env.AI_PROVIDER = "null"
// NODE_ENV is already "test" under vitest and is typed read-only — no need to set it.

// Apply migrations to the test database once. `setupFiles` re-runs this
// module per test file, so skip the (slow, `npx`-spawning) migrate command
// once the database file already exists — schema changes mid-test-run don't
// happen, and a stale/partial db is easy to fix by deleting prisma/test.db.
if (!fs.existsSync(TEST_DB_PATH)) {
  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "pipe",
  })
}

// Import after DATABASE_URL is set so the Prisma client singleton picks it up.
const { prisma } = await import("@/lib/db/client")

/** FK-safe delete order — children before parents. Keeps every test file isolated. */
async function resetDb() {
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.followUp.deleteMany()
  await prisma.interviewPrepPackage.deleteMany()
  await prisma.applicationAnswerSource.deleteMany()
  await prisma.applicationAnswer.deleteMany()
  await prisma.approvalDecision.deleteMany()
  await prisma.applicationStatusEvent.deleteMany()
  await prisma.application.deleteMany()
  await prisma.cvBulletSource.deleteMany()
  await prisma.tailoredCV.deleteMany()
  await prisma.coverLetter.deleteMany()
  await prisma.cvVariant.deleteMany()
  await prisma.jobScore.deleteMany()
  await prisma.jobSourceRecord.deleteMany()
  await prisma.job.deleteMany()
  await prisma.company.deleteMany()
  await prisma.watchedBoard.deleteMany()
  await prisma.searchRun.deleteMany()
  await prisma.predefinedAnswer.deleteMany()
  await prisma.careerEvidence.deleteMany()
  await prisma.candidateProfile.deleteMany()
  await prisma.settings.deleteMany()
}

beforeEach(async () => {
  await resetDb()
})
