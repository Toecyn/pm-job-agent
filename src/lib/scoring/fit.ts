import type { FitBreakdown } from "@/lib/types/scoring"
import { DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS } from "@/lib/types/scoring"
import type { FitBand } from "@/lib/types/enums"
import { clamp, overlapFraction, textContainsAny, weightedScore } from "./shared"
import type { ScoringEvidenceSummary, ScoringJob, ScoringProfile } from "./types"
import { detectConflictingExperienceRange } from "@/lib/normalize/requirementExtractor"

const AI_TERMS = ["ai", "genai", "gen-ai", "ml", "machine learning", "llm", "nlp", "generative ai"]
const SENIORITY_RANK: Record<string, number> = {
  junior: 0,
  mid: 1,
  senior: 2,
  lead: 3,
  principal: 4,
  group: 4,
  unknown: 1,
}

export interface FitScoreOutput {
  fitScore: number
  fitBand: FitBand
  breakdown: FitBreakdown
  reasons: string[]
  concerns: string[]
}

/**
 * Transparent 0-100 fit score (brief §7). Every component is computed from
 * an explicit, inspectable rule — never a black-box "semantic similarity"
 * number — so "why this role matches" (§42) can always be traced back to
 * real data. Required vs. preferred vs. nice-to-have are weighted
 * differently and a missing *preferred* item is only ever a light penalty
 * (see requiredQualificationMatch/preferredQualificationMatch below).
 */
export function scoreFit(
  profile: ScoringProfile,
  evidence: ScoringEvidenceSummary,
  job: ScoringJob,
  weights: typeof DEFAULT_FIT_WEIGHTS = DEFAULT_FIT_WEIGHTS,
  thresholds: typeof DEFAULT_FIT_THRESHOLDS = DEFAULT_FIT_THRESHOLDS
): FitScoreOutput {
  const reasons: string[] = []
  const concerns: string[] = []
  const req = job.requirements

  // 1. Experience match
  let experienceMatch = 80
  if (req.yearsExperienceMin !== undefined && profile.yearsExperience !== undefined) {
    const gap = req.yearsExperienceMin - profile.yearsExperience
    experienceMatch = gap <= 0 ? 100 : clamp(100 - gap * 20)
    if (gap <= 0) reasons.push(`You have ${profile.yearsExperience}+ years of experience, meeting the ${req.yearsExperienceMin}+ year requirement.`)
    else if (gap > 2) concerns.push(`Role asks for ${req.yearsExperienceMin}+ years of experience; your profile lists ${profile.yearsExperience}.`)
  }
  const conflict = detectConflictingExperienceRange(req)
  if (conflict) concerns.push(conflict)

  // 2. Seniority match
  const jobRank = SENIORITY_RANK[job.seniority] ?? 1
  const targetRanks = profile.targetSeniority.map((s) => SENIORITY_RANK[s] ?? 1)
  const closestGap = targetRanks.length ? Math.min(...targetRanks.map((r) => Math.abs(r - jobRank))) : 0
  const seniorityMatch = clamp(100 - closestGap * 30)
  if (closestGap === 0) reasons.push(`Seniority (${job.seniority}) matches your target level.`)
  else if (closestGap >= 2) concerns.push(`Role seniority (${job.seniority}) is well outside your configured target seniorities.`)

  // 3. PM skill match
  const candidatePmSkills = [...profile.pmSkills, ...profile.productAreas]
  const pmSkillMatch = clamp(overlapFraction(req.requiredSkills.concat(req.methodologies), candidatePmSkills.length ? candidatePmSkills : req.requiredSkills) * 100)

  // 4. Industry/domain match
  const candidateIndustries = [...profile.industries, ...profile.targetIndustries]
  const domainTerms = [...req.industryExperience, ...req.domainRequirements]
  const industryDomainMatch = domainTerms.length ? clamp(overlapFraction(domainTerms, candidateIndustries) * 100) : 75
  if (domainTerms.length && industryDomainMatch < 40) {
    concerns.push(`Role emphasizes ${domainTerms.slice(0, 2).join(", ")} domain experience, which isn't prominent in your profile.`)
  } else if (domainTerms.length && industryDomainMatch >= 70) {
    reasons.push(`Your background aligns with the role's ${domainTerms.slice(0, 2).join(", ")} domain focus.`)
  }

  // 5. Technical skill match
  const technicalSkillMatch = req.techRequirements.length
    ? clamp(overlapFraction(req.techRequirements, profile.technicalSkills) * 100)
    : 70

  // 6. AI/data experience
  const jobWantsAiData = textContainsAny(req.keywords.join(" ") + job.title, AI_TERMS) || req.techRequirements.some((t) => AI_TERMS.includes(t.toLowerCase()))
  let aiDataExperience = 70
  if (jobWantsAiData) {
    const candidateAiSignals = [...profile.aiMlExperience, ...profile.dataSkills]
    aiDataExperience = clamp(candidateAiSignals.length ? Math.min(100, 40 + candidateAiSignals.length * 15) : 20)
    if (aiDataExperience >= 70) reasons.push("Role has meaningful AI/GenAI scope and you have direct AI/ML product experience.")
    else concerns.push("Role has significant AI/ML scope; your profile shows limited direct AI/ML product experience.")
  }

  // 7. Leadership experience
  const wantsLeadership = Boolean(req.leadershipRequirements) || job.seniority === "lead" || job.seniority === "principal" || job.seniority === "group"
  let leadershipExperience = 75
  if (wantsLeadership) {
    leadershipExperience = clamp(profile.leadership.length ? Math.min(100, 40 + profile.leadership.length * 15) : 25)
    if (leadershipExperience < 50) concerns.push("Role expects people-leadership or cross-functional leadership at a level not clearly evidenced in your profile.")
  }

  // 8/9. Required vs preferred qualification match — the core "don't auto-reject on a missing preferred item" logic.
  const candidateCorpus = [
    ...profile.pmSkills,
    ...profile.technicalSkills,
    ...profile.dataSkills,
    ...profile.aiMlExperience,
    ...profile.leadership,
    ...profile.industries,
    ...profile.productAreas,
    profile.currentRole ?? "",
  ]
  const requiredHits = req.requiredQualifications.filter((q) => overlapFraction([q], candidateCorpus) > 0)
  const missingRequiredQualifications = req.requiredQualifications.filter((q) => !requiredHits.includes(q))
  const requiredQualificationMatch = req.requiredQualifications.length
    ? clamp((requiredHits.length / req.requiredQualifications.length) * 100)
    : 80

  const preferredHits = req.preferredQualifications.filter((q) => overlapFraction([q], candidateCorpus) > 0)
  const missingPreferredQualifications = req.preferredQualifications.filter((q) => !preferredHits.includes(q))
  const preferredFraction = req.preferredQualifications.length ? preferredHits.length / req.preferredQualifications.length : 1
  const preferredQualificationMatch = clamp(40 + preferredFraction * 60) // floor of 40: missing "nice to haves" never craters this component

  if (missingRequiredQualifications.length) {
    concerns.push(
      `Potential concern: role lists ${missingRequiredQualifications.length} required qualification(s) not clearly evidenced in your profile — e.g. "${missingRequiredQualifications[0].slice(0, 90)}".`
    )
  }

  // 10. Location match
  let locationMatch = 60
  if (job.remoteStatus === "remote") {
    locationMatch = profile.workModePreference === "onsite" ? 60 : 100
    if (locationMatch >= 90) reasons.push("Fully remote — matches your work-location preference.")
  } else {
    const countryMatch = job.countries.some((c) => profile.preferredCountries.includes(c))
    const cityMatch = job.location ? profile.preferredCities.some((c) => job.location!.toLowerCase().includes(c.toLowerCase())) : false
    if (countryMatch || cityMatch) locationMatch = 100
    else if (profile.willingToRelocate) locationMatch = 65
    else locationMatch = 20
    if (locationMatch <= 30) concerns.push(`Role is ${job.remoteStatus} in a location outside your preferred countries/cities and you've indicated limited relocation willingness.`)
  }

  // 11. Work authorization match
  let workAuthorizationMatch = 70
  const authText = req.workAuthRequirements ?? ""
  const requiresClearanceOrCitizenship = /\bmust be.*citizen|security clearance|ts\/sci/i.test(authText)
  const noSponsorship = /do not sponsor|no sponsorship/i.test(authText)
  const explicitlyOpenWorldwide = /no work authorization restriction|hires? via eor|employer of record|open to (all countries|candidates worldwide)|no restrictions on (location|country)/i.test(authText)
  if (requiresClearanceOrCitizenship) {
    workAuthorizationMatch = 5
    concerns.push(`Potential concern: role requires ${authText.trim()}`)
  } else if (noSponsorship && profile.workAuthorization?.sponsorshipNeeded) {
    workAuthorizationMatch = 15
    concerns.push("Potential concern: role does not sponsor visas and your profile indicates sponsorship would be needed.")
  } else if (explicitlyOpenWorldwide) {
    workAuthorizationMatch = 95
    reasons.push("Role explicitly states no work-authorization restrictions for your location.")
  } else if (job.remoteStatus === "remote" && !authText) {
    workAuthorizationMatch = 90
  }

  // 12. Compensation match
  let compensationMatch = 60
  if (job.compConfidence === "known" && profile.preferredComp?.min !== undefined) {
    const jobMax = job.salaryMax ?? job.salaryMin ?? 0
    if (jobMax >= profile.preferredComp.min) compensationMatch = 100
    else {
      const gapFraction = (profile.preferredComp.min - jobMax) / profile.preferredComp.min
      compensationMatch = clamp(100 - gapFraction * 150)
      if (compensationMatch < 40) concerns.push("Listed salary range appears below your stated compensation expectation.")
    }
  } else if (job.compConfidence === "unknown") {
    compensationMatch = 55
  }

  // 13. Remote/hybrid preference match
  let remoteHybridMatch = 70
  if (profile.workModePreference === "any") remoteHybridMatch = 90
  else if (profile.workModePreference === job.remoteStatus) remoteHybridMatch = 100
  else if (profile.workModePreference === "remote" && job.remoteStatus !== "remote") remoteHybridMatch = 30

  // 14. Career trajectory
  const jumpSize = jobRank - (SENIORITY_RANK[profile.targetSeniority[0]] ?? 1)
  const careerTrajectory = clamp(85 - Math.max(0, jumpSize - 1) * 25)

  // 15. Evidence strength — how much tagged career evidence exists to draw on for this role family.
  const relevantTagHits = Object.entries(evidence.tagCounts).reduce((sum, [, count]) => sum + count, 0)
  const evidenceStrength = clamp(evidence.totalCount ? Math.min(100, 30 + relevantTagHits * 5) : 20)

  const breakdown: FitBreakdown = {
    experienceMatch,
    seniorityMatch,
    pmSkillMatch,
    industryDomainMatch,
    technicalSkillMatch,
    aiDataExperience,
    leadershipExperience,
    requiredQualificationMatch,
    preferredQualificationMatch,
    locationMatch,
    workAuthorizationMatch,
    compensationMatch,
    remoteHybridMatch,
    careerTrajectory,
    evidenceStrength,
    missingRequiredQualifications,
    missingPreferredQualifications,
    notes: [],
  }

  const fitScore = weightedScore(breakdown as unknown as Record<string, number>, weights as unknown as Record<string, number>)

  let fitBand: FitBand = "do_not_apply"
  if (fitScore >= thresholds.exceptional) fitBand = "exceptional"
  else if (fitScore >= thresholds.strong) fitBand = "strong"
  else if (fitScore >= thresholds.good) fitBand = "good"
  else if (fitScore >= thresholds.possible) fitBand = "possible"

  if (fitScore >= thresholds.exceptional) {
    reasons.unshift(`Exceptional overall fit (${fitScore}/100) across experience, skills, and domain alignment.`)
  }

  return { fitScore, fitBand, breakdown, reasons: dedupe(reasons), concerns: dedupe(concerns) }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr))
}
