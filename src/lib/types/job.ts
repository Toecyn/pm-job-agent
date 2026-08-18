import { z } from "zod"
import { Confidence, EmploymentType, RemoteStatus } from "./enums"

/**
 * What a source adapter hands back. Deliberately loose/raw — the Job
 * Normalizer (src/lib/normalize) turns this into the strict `Job` row.
 * Adapters must NOT invent postedAt: if the source doesn't expose a reliable
 * original-posting date, leave it undefined (brief §48).
 */
export const RawJobPostingSchema = z.object({
  source: z.string(),
  sourceJobId: z.string(),
  title: z.string(),
  companyName: z.string(),
  location: z.string().optional(),
  remoteStatus: RemoteStatus.default("unknown"),
  countries: z.array(z.string()).default([]),

  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  salaryPeriod: z.enum(["year", "month", "hour"]).optional(),

  employmentType: EmploymentType.default("unknown"),
  department: z.string().optional(),

  applicationUrl: z.string(),
  originalUrl: z.string(),

  postedAt: z.string().datetime().optional(), // ISO — only when source-reported
  postedAtConfidence: Confidence.default("unknown"),
  updatedAt: z.string().datetime().optional(),
  closingAt: z.string().datetime().optional(),

  description: z.string(),
  rawPayload: z.unknown().optional(),
})
export type RawJobPosting = z.infer<typeof RawJobPostingSchema>

export const SourceSearchParamsSchema = z.object({
  titles: z.array(z.string()),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  locations: z.array(z.string()).default([]),
  countries: z.array(z.string()).default([]),
  remotePreference: z.string().default("any"),
  // Adapter-specific target list, e.g. Greenhouse board tokens or Lever org
  // slugs the user has configured to watch.
  boardTokens: z.array(z.string()).default([]),
})
export type SourceSearchParams = z.infer<typeof SourceSearchParamsSchema>

/** Structured requirement extraction from a job description (brief §6). */
export const JobRequirementsSchema = z.object({
  requiredQualifications: z.array(z.string()).default([]),
  preferredQualifications: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  industryExperience: z.array(z.string()).default([]),
  educationRequirements: z.string().optional(),
  yearsExperienceMin: z.number().optional(),
  yearsExperienceMax: z.number().optional(),
  techRequirements: z.array(z.string()).default([]),
  methodologies: z.array(z.string()).default([]),
  leadershipRequirements: z.string().optional(),
  domainRequirements: z.array(z.string()).default([]),
  workAuthRequirements: z.string().optional(),
  travelRequirements: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  atsKeywords: z.array(z.string()).default([]),
})
export type JobRequirements = z.infer<typeof JobRequirementsSchema>
