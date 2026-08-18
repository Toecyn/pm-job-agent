import { prisma } from "@/lib/db/client"
import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"

// SmartRecruiters Posting API — public, documented, no auth required for
// companies that have the public postings feed enabled:
// https://developers.smartrecruiters.com/docs/posting-api
const BASE_URL = "https://api.smartrecruiters.com/v1/companies"

interface SmartRecruitersListItem {
  id: string
  name: string
  releasedDate?: string // ISO — reliable original-posting timestamp
  location?: { city?: string; region?: string; country?: string; remote?: boolean }
  department?: { label?: string }
  typeOfEmployment?: { label?: string }
}

interface SmartRecruitersListResponse {
  totalFound: number
  content: SmartRecruitersListItem[]
}

interface SmartRecruitersJobAdSection {
  title?: string
  text?: string
}

interface SmartRecruitersPosting extends SmartRecruitersListItem {
  applyUrl: string
  postingUrl: string
  jobAd?: {
    sections?: {
      jobDescription?: SmartRecruitersJobAdSection
      qualifications?: SmartRecruitersJobAdSection
      companyDescription?: SmartRecruitersJobAdSection
      additionalInformation?: SmartRecruitersJobAdSection
    }
  }
  compensation?: { min?: number; max?: number; currency?: string; period?: string }
}

function stripHtml(html: string | undefined): string {
  if (!html) return ""
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

function mapEmploymentType(label?: string): "full_time" | "part_time" | "contract" | "internship" | "unknown" {
  const v = (label ?? "").toLowerCase()
  if (v.includes("intern")) return "internship"
  if (v.includes("part")) return "part_time"
  if (v.includes("contract") || v.includes("temporary")) return "contract"
  if (v.includes("full")) return "full_time"
  return "unknown"
}

function locationLabel(loc?: SmartRecruitersListItem["location"]): string | undefined {
  const parts = [loc?.city, loc?.region, loc?.country].filter(Boolean)
  return parts.length ? parts.join(", ") : undefined
}

async function fetchDetail(companyId: string, postingId: string): Promise<SmartRecruitersPosting | undefined> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(companyId)}/postings/${encodeURIComponent(postingId)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  })
  if (!res.ok) return undefined
  return (await res.json()) as SmartRecruitersPosting
}

async function fetchCompany(companyId: string, label: string): Promise<{ postings: RawJobPosting[]; warning?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(companyId)}/postings?limit=100`, {
      headers: { Accept: "application/json" },
      // Public, cacheable data — short revalidate window is enough for a
      // job-hunting cadence that runs at most a few times a day.
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return { postings: [], warning: `smartrecruiters:${companyId} responded ${res.status}` }
    }
    const data = (await res.json()) as SmartRecruitersListResponse
    const postings: RawJobPosting[] = []
    // The list endpoint omits applyUrl/jobAd — SmartRecruiters only returns
    // those on the per-posting detail endpoint, so one extra fetch per job
    // is unavoidable here (unlike Greenhouse/Lever/Ashby's single-call APIs).
    for (const item of data.content ?? []) {
      const detail = await fetchDetail(companyId, item.id)
      const sections = detail?.jobAd?.sections
      const description = [
        stripHtml(sections?.companyDescription?.text),
        stripHtml(sections?.jobDescription?.text),
        sections?.qualifications?.text ? `Qualifications:\n${stripHtml(sections.qualifications.text)}` : undefined,
        stripHtml(sections?.additionalInformation?.text),
      ]
        .filter(Boolean)
        .join("\n\n")
      postings.push({
        source: "smartrecruiters",
        sourceJobId: item.id,
        title: item.name,
        companyName: label,
        location: locationLabel(item.location),
        remoteStatus: item.location?.remote ? "remote" : "unknown",
        countries: [item.location?.country].filter((c): c is string => Boolean(c)),
        employmentType: mapEmploymentType(item.typeOfEmployment?.label),
        department: item.department?.label,
        applicationUrl: detail?.applyUrl ?? detail?.postingUrl ?? `https://jobs.smartrecruiters.com/${companyId}/${item.id}`,
        originalUrl: detail?.postingUrl ?? detail?.applyUrl ?? `https://jobs.smartrecruiters.com/${companyId}/${item.id}`,
        postedAt: item.releasedDate ? new Date(item.releasedDate).toISOString() : undefined,
        postedAtConfidence: item.releasedDate ? "known" : "unknown",
        salaryMin: detail?.compensation?.min,
        salaryMax: detail?.compensation?.max,
        salaryCurrency: detail?.compensation?.currency,
        salaryPeriod: detail?.compensation?.period as "year" | "month" | "hour" | undefined,
        description: description || item.name,
        rawPayload: detail ?? item,
      })
    }
    return { postings }
  } catch (err) {
    return { postings: [], warning: `smartrecruiters:${companyId} fetch failed: ${(err as Error).message}` }
  }
}

export const smartRecruitersAdapter: JobSourceAdapter = {
  id: "smartrecruiters",
  displayName: "SmartRecruiters Job Boards",
  // Discovery is real and safe (public, documented, no-login API). Submission
  // automation is a separate capability — no form filler has been written
  // (or verified against real SmartRecruiters application pages) yet, so
  // this stays false until src/lib/automation/fillers/smartrecruiters.ts
  // exists and is wired into runner.ts's FILLERS map. Until then, matches go
  // through the normal "prepare everything, human submits" flow (brief §3, §15-16).
  automatable: false,
  legalBasis:
    "Uses SmartRecruiters' public, documented Posting API (api.smartrecruiters.com) — no login required for companies with the public postings feed enabled.",
  async search(): Promise<SourceSearchResult> {
    const boards = await prisma.watchedBoard.findMany({ where: { source: "smartrecruiters", enabled: true } })
    const warnings: string[] = []
    const postings: RawJobPosting[] = []
    for (const board of boards) {
      const result = await fetchCompany(board.token, board.label)
      postings.push(...result.postings)
      if (result.warning) warnings.push(result.warning)
    }
    return { postings, warnings }
  },
}
