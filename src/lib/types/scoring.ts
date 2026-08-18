import { z } from "zod"
import { FitBand } from "./enums"

export const FitBreakdownSchema = z.object({
  experienceMatch: z.number().min(0).max(100),
  seniorityMatch: z.number().min(0).max(100),
  pmSkillMatch: z.number().min(0).max(100),
  industryDomainMatch: z.number().min(0).max(100),
  technicalSkillMatch: z.number().min(0).max(100),
  aiDataExperience: z.number().min(0).max(100),
  leadershipExperience: z.number().min(0).max(100),
  requiredQualificationMatch: z.number().min(0).max(100),
  preferredQualificationMatch: z.number().min(0).max(100),
  locationMatch: z.number().min(0).max(100),
  workAuthorizationMatch: z.number().min(0).max(100),
  compensationMatch: z.number().min(0).max(100),
  remoteHybridMatch: z.number().min(0).max(100),
  careerTrajectory: z.number().min(0).max(100),
  evidenceStrength: z.number().min(0).max(100),
  missingRequiredQualifications: z.array(z.string()).default([]),
  missingPreferredQualifications: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
})
export type FitBreakdown = z.infer<typeof FitBreakdownSchema>

export const QualityBreakdownSchema = z.object({
  companyReputation: z.number().min(0).max(100),
  productMaturity: z.number().min(0).max(100),
  productOwnershipScope: z.number().min(0).max(100),
  careerGrowthPotential: z.number().min(0).max(100),
  leadershipExposure: z.number().min(0).max(100),
  compensationQuality: z.number().min(0).max(100),
  remoteFlexibility: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  aiDataExposure: z.number().min(0).max(100),
  scopeOfResponsibility: z.number().min(0).max(100),
  resumeValue: z.number().min(0).max(100),
  notes: z.array(z.string()).default([]),
})
export type QualityBreakdown = z.infer<typeof QualityBreakdownSchema>

export const PriorityBreakdownSchema = z.object({
  fitScore: z.number(),
  qualityScore: z.number(),
  careerValue: z.number(),
  applicationProbability: z.number(),
  compensationAttractiveness: z.number(),
  strategicRelevance: z.number(),
  recencyBoost: z.number(),
})
export type PriorityBreakdown = z.infer<typeof PriorityBreakdownSchema>

export const JobScoreResultSchema = z.object({
  fitScore: z.number().min(0).max(100),
  fitBand: FitBand,
  fitBreakdown: FitBreakdownSchema,
  qualityScore: z.number().min(0).max(100),
  qualityBreakdown: QualityBreakdownSchema,
  priorityScore: z.number().min(0).max(100),
  priorityBreakdown: PriorityBreakdownSchema,
  reasons: z.array(z.string()),
  concerns: z.array(z.string()),
})
export type JobScoreResult = z.infer<typeof JobScoreResultSchema>

/** Default component weights — all visible and editable via Settings (brief §25, §43). */
export const DEFAULT_FIT_WEIGHTS = {
  experienceMatch: 0.14,
  seniorityMatch: 0.1,
  pmSkillMatch: 0.14,
  industryDomainMatch: 0.07,
  technicalSkillMatch: 0.06,
  aiDataExperience: 0.06,
  leadershipExperience: 0.07,
  requiredQualificationMatch: 0.15,
  preferredQualificationMatch: 0.05,
  locationMatch: 0.04,
  workAuthorizationMatch: 0.05,
  compensationMatch: 0.02,
  remoteHybridMatch: 0.02,
  careerTrajectory: 0.02,
  evidenceStrength: 0.01,
} as const

export const DEFAULT_QUALITY_WEIGHTS = {
  companyReputation: 0.12,
  productMaturity: 0.1,
  productOwnershipScope: 0.12,
  careerGrowthPotential: 0.12,
  leadershipExposure: 0.09,
  compensationQuality: 0.12,
  remoteFlexibility: 0.06,
  stability: 0.09,
  aiDataExposure: 0.08,
  scopeOfResponsibility: 0.06,
  resumeValue: 0.04,
} as const

export const DEFAULT_PRIORITY_WEIGHTS = {
  fitScore: 0.32,
  qualityScore: 0.24,
  careerValue: 0.14,
  applicationProbability: 0.12,
  compensationAttractiveness: 0.08,
  strategicRelevance: 0.06,
  recencyBoost: 0.04,
} as const

export const DEFAULT_FIT_THRESHOLDS = {
  exceptional: 90,
  strong: 80,
  good: 70,
  possible: 60,
} as const
