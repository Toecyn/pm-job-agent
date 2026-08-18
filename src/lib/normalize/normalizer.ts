import type { RawJobPosting } from "@/lib/types/job"
import { classifyTitle, matchesTargetSeniority } from "./titleTaxonomy"
import { analyzeJobDescription } from "./requirementExtractor"
import { computeDedupFingerprint } from "@/lib/dedup/dedup"

export interface NormalizedJob {
  relevant: boolean
  discardReason?: string
  title: string
  normalizedTitle: string
  titleFamily: string
  seniority: string
  companyName: string
  location?: string
  remoteStatus: string
  countries: string[]
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryPeriod?: string
  compConfidence: "known" | "unknown"
  employmentType: string
  department?: string
  applicationUrl: string
  originalUrl: string
  source: string
  sourceJobId: string
  datePosted?: Date
  datePostedConfidence: "known" | "unknown"
  dateUpdated?: Date
  dateClosing?: Date
  description: string
  dedupFingerprint: string
  rawJson: string
  requirements: Awaited<ReturnType<typeof analyzeJobDescription>>
}

/**
 * Job Normalizer (ARCHITECTURE.md diagram): the single place a RawJobPosting
 * from any adapter becomes the strict shape the rest of the system relies
 * on. Also applies the title-relevance filter (brief §37) — jobs that don't
 * classify as a product-management family are marked `relevant: false` with
 * a reason and are still recorded (for search-history transparency, brief
 * §41) but excluded from scoring/dashboard by default.
 */
export async function normalizeRawPosting(
  raw: RawJobPosting,
  opts: { titleSynonyms?: Record<string, string>; targetSeniorities?: string[] } = {}
): Promise<NormalizedJob> {
  const classification = classifyTitle(raw.title, opts.titleSynonyms)
  const requirements = await analyzeJobDescription(raw.description, raw.title)

  const seniorityOk = matchesTargetSeniority(classification.seniority, opts.targetSeniorities ?? [])

  let relevant = classification.isRelevant
  let discardReason: string | undefined
  if (!classification.isRelevant) {
    discardReason = `Title "${raw.title}" did not match a configured product-management title family.`
  } else if (!seniorityOk) {
    relevant = false
    discardReason = `Seniority "${classification.seniority}" is outside the configured target seniorities.`
  }

  const dedupFingerprint = computeDedupFingerprint({
    companyName: raw.companyName,
    titleFamily: classification.family,
    remoteStatus: raw.remoteStatus,
    location: raw.location,
    countries: raw.countries,
  })

  return {
    relevant,
    discardReason,
    title: raw.title,
    normalizedTitle: raw.title.trim().toLowerCase(),
    titleFamily: classification.family,
    seniority: classification.seniority,
    companyName: raw.companyName,
    location: raw.location,
    remoteStatus: raw.remoteStatus,
    countries: raw.countries,
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    salaryCurrency: raw.salaryCurrency,
    salaryPeriod: raw.salaryPeriod,
    compConfidence: raw.salaryMin || raw.salaryMax ? "known" : "unknown",
    employmentType: raw.employmentType,
    department: raw.department,
    applicationUrl: raw.applicationUrl,
    originalUrl: raw.originalUrl,
    source: raw.source,
    sourceJobId: raw.sourceJobId,
    datePosted: raw.postedAt ? new Date(raw.postedAt) : undefined,
    datePostedConfidence: raw.postedAtConfidence,
    dateUpdated: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
    dateClosing: raw.closingAt ? new Date(raw.closingAt) : undefined,
    description: raw.description,
    dedupFingerprint,
    rawJson: JSON.stringify(raw.rawPayload ?? raw),
    requirements,
  }
}
