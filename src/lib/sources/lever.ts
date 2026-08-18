import { prisma } from "@/lib/db/client"
import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"

// Lever Postings API — public, documented, no auth required:
// https://github.com/lever/postings-api
const BASE_URL = "https://api.lever.co/v0/postings"

interface LeverPosting {
  id: string
  text: string
  createdAt: number // epoch ms — reliable original-posting timestamp
  hostedUrl: string
  applyUrl: string
  categories?: { team?: string; location?: string; commitment?: string }
  workplaceType?: string // "remote" | "hybrid" | "on-site"
  description?: string
  descriptionPlain?: string
  lists?: { text: string; content: string }[]
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string }
}

function remoteStatusFrom(workplaceType?: string, location?: string): "remote" | "hybrid" | "onsite" | "unknown" {
  if (workplaceType === "remote") return "remote"
  if (workplaceType === "hybrid") return "hybrid"
  if (workplaceType === "on-site") return "onsite"
  if (location && /remote/i.test(location)) return "remote"
  return "unknown"
}

function stripHtml(html: string | undefined): string {
  if (!html) return ""
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

async function fetchOrg(org: string, label: string): Promise<{ postings: RawJobPosting[]; warning?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(org)}?mode=json`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return { postings: [], warning: `lever:${org} responded ${res.status}` }
    }
    const jobs = (await res.json()) as LeverPosting[]
    const postings: RawJobPosting[] = jobs.map((job) => {
      const fullDescription = [
        stripHtml(job.descriptionPlain ?? job.description),
        ...(job.lists ?? []).map((l) => `${l.text}\n${stripHtml(l.content)}`),
      ]
        .filter(Boolean)
        .join("\n\n")
      return {
        source: "lever",
        sourceJobId: job.id,
        title: job.text,
        companyName: label,
        location: job.categories?.location,
        remoteStatus: remoteStatusFrom(job.workplaceType, job.categories?.location),
        countries: [],
        employmentType: /intern/i.test(job.categories?.commitment ?? "") ? "internship" : "unknown",
        department: job.categories?.team,
        applicationUrl: job.applyUrl,
        originalUrl: job.hostedUrl,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        postedAtConfidence: job.createdAt ? "known" : "unknown",
        salaryMin: job.salaryRange?.min,
        salaryMax: job.salaryRange?.max,
        salaryCurrency: job.salaryRange?.currency,
        salaryPeriod: job.salaryRange?.interval as "year" | "month" | "hour" | undefined,
        description: fullDescription,
        rawPayload: job,
      }
    })
    return { postings }
  } catch (err) {
    return { postings: [], warning: `lever:${org} fetch failed: ${(err as Error).message}` }
  }
}

export const leverAdapter: JobSourceAdapter = {
  id: "lever",
  displayName: "Lever Job Boards",
  automatable: true,
  legalBasis: "Uses Lever's public, documented Postings API (api.lever.co) — no login required.",
  async search(): Promise<SourceSearchResult> {
    const boards = await prisma.watchedBoard.findMany({ where: { source: "lever", enabled: true } })
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
