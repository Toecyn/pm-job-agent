import { prisma } from "@/lib/db/client"

/**
 * Search-window computation (brief §2): only return jobs posted since the
 * previous *successful* search, with a configurable safety overlap for
 * indexing delays, falling back to a configurable initial window when there
 * is no prior successful run. The anchor for "previous successful search" is
 * always that run's `completedAt`, never `startedAt` — using startedAt would
 * quietly widen the window by however long the run itself took, and using
 * wall-clock "now" at scheduling time would drift under retries.
 */
export interface SearchWindow {
  windowStart: Date
  windowEnd: Date
  basis: "previous_run" | "initial_window"
  previousRunId?: string
}

export async function computeSearchWindow(opts: {
  initialWindowDays: number
  overlapMinutes: number
  now?: Date
}): Promise<SearchWindow> {
  const now = opts.now ?? new Date()
  // A "successful search" (brief §2) means the run produced a usable result,
  // not that every single source responded — one flaky adapter shouldn't
  // permanently widen the window on every subsequent run (ARCHITECTURE.md
  // §12). Only a run where *nothing* could be searched (status "failed")
  // fails to advance the anchor.
  const lastSuccess = await prisma.searchRun.findFirst({
    where: { status: { in: ["success", "partial"] }, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  })

  if (lastSuccess?.completedAt) {
    const windowStart = new Date(lastSuccess.completedAt.getTime() - opts.overlapMinutes * 60_000)
    return { windowStart, windowEnd: now, basis: "previous_run", previousRunId: lastSuccess.id }
  }

  const windowStart = new Date(now.getTime() - opts.initialWindowDays * 24 * 3600_000)
  return { windowStart, windowEnd: now, basis: "initial_window" }
}

/**
 * Whether a normalized job falls inside the window, given its posted-date
 * confidence (brief §48). A job with an unknown/unverifiable posting date is
 * never silently assumed new — it's kept (so nothing is lost) but flagged,
 * and callers should surface it separately rather than mixing it into the
 * "new since last run" count.
 */
export function isWithinWindow(
  datePosted: Date | undefined,
  datePostedConfidence: "known" | "unknown",
  window: SearchWindow
): { withinWindow: boolean; certain: boolean } {
  if (datePostedConfidence === "known" && datePosted) {
    return { withinWindow: datePosted >= window.windowStart && datePosted <= window.windowEnd, certain: true }
  }
  return { withinWindow: true, certain: false }
}
