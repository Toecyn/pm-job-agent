/**
 * Scheduled execution entry point (brief §27). Run this on a schedule via
 * OS-level cron / Windows Task Scheduler / a Docker cron sidecar:
 *
 *   0 7 * * *  cd /path/to/pm-job-agent && npm run search:run
 *
 * Deliberately a standalone script rather than an in-process timer inside
 * the Next.js server — a timer that lives and dies with `next dev`/`next
 * start` is fragile (restarts silently reset it, multiple instances behind
 * a process manager would double-fire). An external scheduler invoking this
 * script is simpler and more reliable, and duplicate/overlapping runs are
 * still safe because computeSearchWindow() anchors off the database, not
 * process memory, and application creation is protected by a DB constraint.
 */
import "dotenv/config"
import { runSearch } from "../src/lib/search/runSearch"
import { checkDueFollowUps } from "../src/lib/followup/engine"
import { prisma } from "../src/lib/db/client"

async function main() {
  console.log(`[${new Date().toISOString()}] Starting scheduled search run...`)
  const result = await runSearch()
  console.log(
    `[${new Date().toISOString()}] Search run ${result.searchRunId} complete: ` +
      `${result.jobsFound} found, ${result.jobsNew} new, ${result.jobsDuplicate} duplicate, ${result.jobsDiscarded} discarded.`
  )
  if (result.errors.length) console.warn("Warnings/errors:", result.errors)

  const dueFollowUps = await checkDueFollowUps()
  console.log(`[${new Date().toISOString()}] ${dueFollowUps} follow-up reminder(s) surfaced.`)
}

main()
  .catch((err) => {
    console.error("Scheduled search run failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
