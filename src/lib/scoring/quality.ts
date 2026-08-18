import type { QualityBreakdown } from "@/lib/types/scoring"
import { DEFAULT_QUALITY_WEIGHTS } from "@/lib/types/scoring"
import { clamp, textContainsAny, weightedScore } from "./shared"
import type { ScoringJob } from "./types"

const AI_TERMS = ["ai", "genai", "gen-ai", "ml", "machine learning", "llm", "nlp"]
const MATURITY_SIGNALS = ["scale", "millions of users", "series c", "series d", "public company", "profitable", "market leader"]
const EARLY_STAGE_SIGNALS = ["pre-seed", "seed stage", "early-stage startup", "series a", "series b"]
const INSTABILITY_SIGNALS = ["layoffs", "hiring freeze", "runway", "restructuring"]

export interface QualityScoreOutput {
  qualityScore: number
  breakdown: QualityBreakdown
  reasons: string[]
  concerns: string[]
}

/**
 * Job Quality Score (brief §8) — deliberately independent from fit. A role
 * can be a perfect skills match at a mediocre opportunity, or an ambitious
 * stretch at an outstanding one; both are useful signals on their own.
 */
export function scoreQuality(job: ScoringJob): QualityScoreOutput {
  const reasons: string[] = []
  const concerns: string[] = []
  const desc = job.requirements.responsibilities.join(" ") + " " + (job.requirements.keywords.join(" ") ?? "")

  const companyReputation = job.companyReputationHint ?? 55 // neutral until Company Intelligence has researched it

  const productMaturity = textContainsAny(desc, MATURITY_SIGNALS)
    ? 80
    : textContainsAny(desc, EARLY_STAGE_SIGNALS)
      ? 45
      : 60

  const scopeSignals = job.requirements.responsibilities.length + job.requirements.requiredQualifications.length
  const productOwnershipScope = clamp(40 + scopeSignals * 5)

  const seniorityGrowth: Record<string, number> = { junior: 85, mid: 75, senior: 65, lead: 55, principal: 50, group: 45, unknown: 60 }
  const careerGrowthPotential = seniorityGrowth[job.seniority] ?? 60

  const leadershipExposure = job.requirements.leadershipRequirements ? 75 : job.seniority === "lead" || job.seniority === "principal" || job.seniority === "group" ? 80 : 45

  let compensationQuality = 50
  if (job.compConfidence === "known" && job.salaryMax) {
    compensationQuality = clamp(Math.round((job.salaryMax / 200000) * 100))
  }

  const remoteFlexibility = job.remoteStatus === "remote" ? 90 : job.remoteStatus === "hybrid" ? 60 : 30

  const stability = textContainsAny(desc, INSTABILITY_SIGNALS) ? 25 : 65
  if (stability <= 30) concerns.push("Job description or company context mentions layoffs/restructuring/limited runway.")

  const aiDataExposure = textContainsAny(desc + job.title, AI_TERMS) ? 85 : 40

  const scopeOfResponsibility = productOwnershipScope

  const resumeValue = clamp(Math.round((companyReputation + productMaturity + careerGrowthPotential) / 3))

  const breakdown: QualityBreakdown = {
    companyReputation,
    productMaturity,
    productOwnershipScope,
    careerGrowthPotential,
    leadershipExposure,
    compensationQuality,
    remoteFlexibility,
    stability,
    aiDataExposure,
    scopeOfResponsibility,
    resumeValue,
    notes: [],
  }

  const qualityScore = weightedScore(breakdown as unknown as Record<string, number>, DEFAULT_QUALITY_WEIGHTS as unknown as Record<string, number>)

  if (qualityScore >= 80) reasons.push(`High job-quality score (${qualityScore}/100): strong scope, growth potential, and flexibility signals.`)
  if (job.compConfidence === "unknown") concerns.push("Salary not disclosed — compensation quality could not be fully assessed.")

  return { qualityScore, breakdown, reasons, concerns }
}
