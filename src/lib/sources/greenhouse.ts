import { prisma } from "@/lib/db/client"
import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"

// Greenhouse Job Board API — public, documented, no auth required:
// https://developers.greenhouse.io/job-board.html
// One JSON endpoint per company's board token; we poll the tokens the user
// has added under Settings > Sources (WatchedBoard rows with source="greenhouse").
const BASE_URL = "https://boards-api.greenhouse.io/v1/boards"

interface GreenhouseJob {
  id: number
  title: string
  updated_at: string
  absolute_url: string
  location?: { name?: string }
  content?: string
  departments?: { name: string }[]
  metadata?: { name: string; value: unknown }[]
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseJob[]
}

function stripHtml(html: string | undefined): string {
  if (!html) return ""
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchBoard(token: string, label: string): Promise<{ postings: RawJobPosting[]; warning?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(token)}/jobs?content=true`, {
      headers: { Accept: "application/json" },
      // Public, cacheable data — short revalidate window is enough for a
      // job-hunting cadence that runs at most a few times a day.
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return { postings: [], warning: `greenhouse:${token} responded ${res.status}` }
    }
    const data = (await res.json()) as GreenhouseBoardResponse
    const postings: RawJobPosting[] = (data.jobs ?? []).map((job) => ({
      source: "greenhouse",
      sourceJobId: String(job.id),
      title: job.title,
      companyName: label,
      location: job.location?.name,
      remoteStatus: /remote/i.test(job.location?.name ?? "") ? "remote" : "unknown",
      countries: [],
      employmentType: "unknown",
      department: job.departments?.[0]?.name,
      applicationUrl: job.absolute_url,
      originalUrl: job.absolute_url,
      // Greenhouse's public board API does not expose an original posting
      // date — only updated_at, which changes on any edit. Per brief §48 we
      // do not guess: postedAt stays unset and confidence stays "unknown".
      postedAtConfidence: "unknown",
      updatedAt: job.updated_at ? new Date(job.updated_at).toISOString() : undefined,
      description: stripHtml(job.content),
      rawPayload: job,
    }))
    return { postings }
  } catch (err) {
    return { postings: [], warning: `greenhouse:${token} fetch failed: ${(err as Error).message}` }
  }
}

export const greenhouseAdapter: JobSourceAdapter = {
  id: "greenhouse",
  displayName: "Greenhouse Job Boards",
  automatable: true, // stable, semantic form structure — see automation agent
  legalBasis:
    "Uses Greenhouse's public, documented Job Board JSON API (boards-api.greenhouse.io) — no login, no scraping of rendered pages.",
  async search(): Promise<SourceSearchResult> {
    const boards = await prisma.watchedBoard.findMany({ where: { source: "greenhouse", enabled: true } })
    const warnings: string[] = []
    const postings: RawJobPosting[] = []
    for (const board of boards) {
      const result = await fetchBoard(board.token, board.label)
      postings.push(...result.postings)
      if (result.warning) warnings.push(result.warning)
    }
    return { postings, warnings }
  },
}
