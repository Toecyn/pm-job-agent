import { beforeEach } from "vitest"
import { TEST_DATABASE_URL } from "./globalSetup"

// Hermetic test environment — deliberately does NOT load the developer's
// .env, so tests never depend on (or clobber) real local settings like
// MOCK_SOURCE_ENABLED or a configured AI provider. The Postgres instance
// itself (start, migrate) is handled once for the whole run by
// globalSetup.ts — this file just points every test file's Prisma client at
// it and resets tables between tests.
process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.NEXTAUTH_SECRET = "test-secret"
process.env.AUTH_USER_EMAIL = "test@example.com"
process.env.AI_PROVIDER = "null"

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
