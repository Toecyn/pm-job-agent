import { prisma } from "@/lib/db/client"
import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"

// Ashby Job Board API — public, documented, no auth required:
// https://developers.ashbyhq.com/reference/jobboardapi
const BASE_URL = "https://api.ashbyhq.com/posting-api/job-board"

interface AshbyJob {
  id: string
  title: string
  department?: string
  team?: string
  employmentType?: string // FullTime | PartTime | Intern | Contract
  location?: string
  isRemote?: boolean
  publishedAt?: string // ISO — reliable
  applyUrl: string
  jobUrl: string
  descriptionPlain?: string
  compensation?: { summary?: string }
}

interface AshbyBoardResponse {
  jobs: AshbyJob[]
}

function mapEmploymentType(t?: string): "full_time" | "part_time" | "contract" | "internship" | "unknown" {
  switch (t) {
    case "FullTime":
      return "full_time"
    case "PartTime":
      return "part_time"
    case "Intern":
      return "internship"
    case "Contract":
      return "contract"
    default:
      return "unknown"
  }
}

async function fetchOrg(org: string, label: string): Promise<{ postings: RawJobPosting[]; warning?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(org)}?includeCompensation=true`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return { postings: [], warning: `ashby:${org} responded ${res.status}` }
    }
    const data = (await res.json()) as AshbyBoardResponse
    const postings: RawJobPosting[] = (data.jobs ?? []).map((job) => ({
      source: "ashby",
      sourceJobId: job.id,
      title: job.title,
      companyName: label,
      location: job.location,
      remoteStatus: job.isRemote ? "remote" : "unknown",
      countries: [],
      employmentType: mapEmploymentType(job.employmentType),
      department: job.department ?? job.team,
      applicationUrl: job.applyUrl,
      originalUrl: job.jobUrl,
      postedAt: job.publishedAt ? new Date(job.publishedAt).toISOString() : undefined,
      postedAtConfidence: job.publishedAt ? "known" : "unknown",
      description: [job.descriptionPlain, job.compensation?.summary].filter(Boolean).join("\n\n"),
      rawPayload: job,
    }))
    return { postings }
  } catch (err) {
    return { postings: [], warning: `ashby:${org} fetch failed: ${(err as Error).message}` }
  }
}

export const ashbyAdapter: JobSourceAdapter = {
  id: "ashby",
  displayName: "Ashby Job Boards",
  automatable: true,
  legalBasis: "Uses Ashby's public, documented Job Board API (api.ashbyhq.com) — no login required.",
  async search(): Promise<SourceSearchResult> {
    const boards = await prisma.watchedBoard.findMany({ where: { source: "ashby", enabled: true } })
    const warnings: string[] = []
    const postings: RawJobPosting[] = []
    for (const board of boards) {
      const result = await fetchOrg(board.token, board.label)
      postings.push(...result.postings)
      if (result.warning) warnings.push(result.warning)
    }
    return { postings, warnings }
  },
}
