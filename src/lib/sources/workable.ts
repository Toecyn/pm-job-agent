import { prisma } from "@/lib/db/client"
import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"

// Workable Job Board Widget API — public, unauthenticated, no login required.
// This is the same endpoint Workable's own embeddable "jobs widget" calls
// from customers' career pages, so it's meant for exactly this kind of read:
// https://help.workable.com/hc/en-us/articles/115012801727-How-to-embed-jobs-on-your-website-job-widget
const BASE_URL = "https://apply.workable.com/api/v1/widget/accounts"

interface WorkableLocation {
  country?: string
  countryCode?: string
  city?: string
  region?: string
  hidden?: boolean
}

interface WorkableJob {
  title: string
  shortcode: string
  employment_type?: string // "Full-time" | "Part-time" | "Contract" | "Temporary" | "Internship" | ...
  telecommuting?: boolean
  department?: string
  url: string
  application_url: string
  published_on?: string // "YYYY-MM-DD"
  created_at?: string // "YYYY-MM-DD"
  country?: string
  city?: string
  locations?: WorkableLocation[]
  description?: string
}

interface WorkableWidgetResponse {
  jobs: WorkableJob[]
}

function stripHtml(html: string | undefined): string {
  if (!html) return ""
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function mapEmploymentType(t?: string): "full_time" | "part_time" | "contract" | "internship" | "unknown" {
  const v = (t ?? "").toLowerCase()
  if (v.includes("intern")) return "internship"
  if (v.includes("part")) return "part_time"
  if (v.includes("contract") || v.includes("temporary")) return "contract"
  if (v.includes("full")) return "full_time"
  return "unknown"
}

function locationLabel(job: WorkableJob): string | undefined {
  const loc = job.locations?.[0]
  const parts = [loc?.city ?? job.city, loc?.region, loc?.country ?? job.country].filter(Boolean)
  return parts.length ? parts.join(", ") : undefined
}

async function fetchAccount(account: string, label: string): Promise<{ postings: RawJobPosting[]; warning?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(account)}?details=true`, {
      headers: { Accept: "application/json" },
      // Public, cacheable data — short revalidate window is enough for a
      // job-hunting cadence that runs at most a few times a day.
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return { postings: [], warning: `workable:${account} responded ${res.status}` }
    }
    const data = (await res.json()) as WorkableWidgetResponse
    const postings: RawJobPosting[] = (data.jobs ?? []).map((job) => ({
      source: "workable",
      sourceJobId: job.shortcode,
      title: job.title,
      companyName: label,
      location: locationLabel(job),
      remoteStatus: job.telecommuting ? "remote" : "unknown",
      countries: [job.locations?.[0]?.country ?? job.country].filter((c): c is string => Boolean(c)),
      employmentType: mapEmploymentType(job.employment_type),
      department: job.department,
      applicationUrl: job.application_url,
      originalUrl: job.url,
      postedAt: job.published_on ? new Date(job.published_on).toISOString() : undefined,
      postedAtConfidence: job.published_on ? "known" : "unknown",
      description: stripHtml(job.description),
      rawPayload: job,
    }))
    return { postings }
  } catch (err) {
    return { postings: [], warning: `workable:${account} fetch failed: ${(err as Error).message}` }
  }
}

export const workableAdapter: JobSourceAdapter = {
  id: "workable",
  displayName: "Workable Job Boards",
  // Discovery is real and safe (public, documented, no-login API). Submission
  // automation is a separate capability — no form filler has been written
  // (or verified against real Workable application pages) yet, so this stays
  // false until src/lib/automation/fillers/workable.ts exists and is wired
  // into runner.ts's FILLERS map. Until then, matches go through the normal
  // "prepare everything, human submits" flow (brief §3, §15-16).
  automatable: false,
  legalBasis:
    "Uses Workable's public job board widget API (apply.workable.com/api/v1/widget) — the same endpoint Workable's own embeddable careers-page widget calls; no login required.",
  async search(): Promise<SourceSearchResult> {
    const boards = await prisma.watchedBoard.findMany({ where: { source: "workable", enabled: true } })
    const warnings: string[] = []
    const postings: RawJobPosting[] = []
    for (const board of boards) {
      const result = await fetchAccount(board.token, board.label)
      postings.push(...result.postings)
      if (result.warning) warnings.push(result.warning)
    }
    return { postings, warnings }
  },
}
