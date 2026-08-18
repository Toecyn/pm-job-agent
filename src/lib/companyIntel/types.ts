import { z } from "zod"

/**
 * Every field defaults to "UNKNOWN" rather than being guessed (brief §35).
 * Populated either from the company's own public website (fetched with a
 * robots.txt check, same as Manual Import) or left UNKNOWN if no website is
 * on file — never fabricated from an AI model's general "recall" of a
 * company it wasn't actually given text about.
 */
export const CompanyIntelSchema = z.object({
  productOverview: z.string().default("UNKNOWN"),
  businessModel: z.string().default("UNKNOWN"),
  recentAnnouncements: z.array(z.string()).default([]),
  fundingStatus: z.string().default("UNKNOWN"),
  leadership: z.array(z.string()).default([]),
  productStrategyNotes: z.string().default("UNKNOWN"),
  competitors: z.array(z.string()).default([]),
  hiringTrendsNote: z.string().default("UNKNOWN — not reliably determinable from public sources without a dedicated data provider."),
  recentProductLaunches: z.array(z.string()).default([]),
  technologyStack: z.array(z.string()).default([]),
  cultureIndicators: z.array(z.string()).default([]),
  challenges: z.array(z.string()).default([]),
})
export type CompanyIntel = z.infer<typeof CompanyIntelSchema>

export interface CompanyIntelResult {
  intel: CompanyIntel
  networkingRecommendation: string
  sourceNote: string
  reputationScore: number
}
