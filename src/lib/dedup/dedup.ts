import { prisma } from "@/lib/db/client"

/**
 * Duplicate-posting detection across sources (brief §18): the same role
 * commonly appears on LinkedIn, a Greenhouse board, and the company's own
 * careers page simultaneously. We never rely on source+sourceJobId alone
 * (that only detects re-discovery of a job we already have from the *same*
 * source — handled separately via the JobSourceRecord unique constraint).
 */

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|plc|gmbh)\.?\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

export function locationBucket(remoteStatus: string, location?: string, countries: string[] = []): string {
  if (remoteStatus === "remote") return "remote"
  if (location) {
    return location
      .toLowerCase()
      .split(",")[0]
      .replace(/[^a-z0-9]/g, "")
      .trim()
  }
  return countries.join("|").toLowerCase() || "unknown"
}

export function computeDedupFingerprint(params: {
  companyName: string
  titleFamily: string
  remoteStatus: string
  location?: string
  countries?: string[]
}): string {
  return [
    normalizeCompanyName(params.companyName),
    params.titleFamily,
    locationBucket(params.remoteStatus, params.location, params.countries ?? []),
  ].join("::")
}

/** Jaccard similarity over word sets — cheap, dependency-free fuzzy text match. */
export function textSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
  const setB = new Set(b.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
  if (!setA.size || !setB.size) return 0
  let intersection = 0
  for (const w of setA) if (setB.has(w)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export interface DuplicateCheckInput {
  companyName: string
  titleFamily: string
  remoteStatus: string
  location?: string
  countries?: string[]
  description: string
  applicationUrl: string
  originalUrl: string
}

/**
 * Returns the id of an existing Job this posting duplicates, or null if it's
 * genuinely new. Checked in three passes, cheapest/most-certain first:
 *  1. Exact application/original URL match.
 *  2. Exact fingerprint match (company + title family + location bucket).
 *  3. Fuzzy: same normalized company + description similarity >= 0.55.
 */
export async function findDuplicateJob(input: DuplicateCheckInput): Promise<string | null> {
  const byUrl = await prisma.job.findFirst({
    where: { OR: [{ applicationUrl: input.applicationUrl }, { originalUrl: input.originalUrl }] },
    select: { id: true },
  })
  if (byUrl) return byUrl.id

  const fingerprint = computeDedupFingerprint(input)
  const byFingerprint = await prisma.job.findFirst({
    where: { dedupFingerprint: fingerprint },
    select: { id: true },
  })
  if (byFingerprint) return byFingerprint.id

  const normalizedCompany = normalizeCompanyName(input.companyName)
  const candidates = await prisma.job.findMany({
    where: { companyName: { contains: input.companyName.split(" ")[0] } },
    select: { id: true, companyName: true, description: true },
    take: 50,
    orderBy: { createdAt: "desc" },
  })
  for (const candidate of candidates) {
    if (normalizeCompanyName(candidate.companyName) !== normalizedCompany) continue
    if (textSimilarity(candidate.description, input.description) >= 0.55) return candidate.id
  }

  return null
}
