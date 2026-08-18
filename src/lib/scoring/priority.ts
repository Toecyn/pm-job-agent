import type { PriorityBreakdown } from "@/lib/types/scoring"
import { DEFAULT_PRIORITY_WEIGHTS } from "@/lib/types/scoring"
import { clamp } from "./shared"
import type { ScoringJob, ScoringProfile } from "./types"
import type { FitScoreOutput } from "./fit"
import type { QualityScoreOutput } from "./quality"

export interface PriorityScoreOutput {
  priorityScore: number
  breakdown: PriorityBreakdown
}

/**
 * Application Priority Score (brief §9-§40): the number the dashboard
 * actually ranks by. Deliberately blends recency in at a small, fixed
 * weight so "a 95% fit posted 2 hours ago" outranks "a 70% fit posted 30
 * minutes ago" (brief §40 worked example) without recency ever dominating
 * fit/quality.
 */
export function scorePriority(
  profile: ScoringProfile,
  job: ScoringJob,
  fit: FitScoreOutput,
  quality: QualityScoreOutput,
  weights: typeof DEFAULT_PRIORITY_WEIGHTS = DEFAULT_PRIORITY_WEIGHTS
): PriorityScoreOutput {
  const careerValue = clamp(Math.round((quality.breakdown.careerGrowthPotential + quality.breakdown.resumeValue + fit.breakdown.careerTrajectory) / 3))

  // Application probability: higher when required-qualification match is strong and role isn't wildly senior-mismatched.
  const applicationProbability = clamp(
    Math.round(fit.breakdown.requiredQualificationMatch * 0.6 + fit.breakdown.seniorityMatch * 0.4)
  )

  let compensationAttractiveness = 50
  if (job.compConfidence === "known") {
    compensationAttractiveness = quality.breakdown.compensationQuality
  }

  const strategicRelevance = clamp(
    Math.round((fit.breakdown.industryDomainMatch + fit.breakdown.aiDataExperience + quality.breakdown.aiDataExposure) / 3)
  )

  const hoursSincePosted = job.datePosted ? (Date.now() - job.datePosted.getTime()) / 3600_000 : 999
  const recencyBoost = clamp(hoursSincePosted <= 24 ? 100 - hoursSincePosted * 2 : Math.max(0, 50 - (hoursSincePosted - 24) / 4))

  const breakdown: PriorityBreakdown = {
    fitScore: fit.fitScore,
    qualityScore: quality.qualityScore,
    careerValue,
    applicationProbability,
    compensationAttractiveness,
    strategicRelevance,
    recencyBoost,
  }

  const priorityScore = clamp(
    Math.round(
      fit.fitScore * weights.fitScore +
        quality.qualityScore * weights.qualityScore +
        careerValue * weights.careerValue +
        applicationProbability * weights.applicationProbability +
        compensationAttractiveness * weights.compensationAttractiveness +
        strategicRelevance * weights.strategicRelevance +
        recencyBoost * weights.recencyBoost
    )
  )

  return { priorityScore, breakdown }
}
