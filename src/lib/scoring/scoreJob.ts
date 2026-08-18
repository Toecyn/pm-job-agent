import { prisma } from "@/lib/db/client"
import { fromJson, fromJsonArray, toJson } from "@/lib/utils/json"
import { decryptJson } from "@/lib/security/crypto"
import { getSettings } from "@/lib/config/settings"
import { scoreFit } from "./fit"
import { scoreQuality } from "./quality"
import { scorePriority } from "./priority"
import type { ScoringEvidenceSummary, ScoringJob, ScoringProfile } from "./types"
import type { JobRequirements } from "@/lib/types/job"
import type { WorkAuthorization, CompensationExpectation } from "@/lib/types/profile"
import { audit } from "@/lib/audit/logger"
import type { CandidateProfile, Job, Company } from "@prisma/client"

export function buildScoringProfile(profile: CandidateProfile): ScoringProfile {
  return {
    yearsExperience: profile.yearsExperience ?? undefined,
    currentRole: profile.currentRole ?? undefined,
    targetSeniority: fromJsonArray<string>(profile.targetSeniorityJson),
    preferredCountries: fromJsonArray<string>(profile.preferredCountriesJson),
    preferredCities: fromJsonArray<string>(profile.preferredCitiesJson),
    workModePreference: profile.workModePreference,
    willingToRelocate: profile.willingToRelocate,
    workAuthorization: decryptJson<WorkAuthorization | undefined>(profile.workAuthorizationEnc, undefined),
    preferredComp: decryptJson<CompensationExpectation | undefined>(profile.preferredCompEnc, undefined),
    industries: fromJsonArray<string>(profile.industriesJson),
    targetIndustries: fromJsonArray<string>(profile.targetIndustriesJson),
    productAreas: fromJsonArray<string>(profile.productAreasJson),
    technicalSkills: fromJsonArray<string>(profile.technicalSkillsJson),
    pmSkills: fromJsonArray<string>(profile.pmSkillsJson),
    dataSkills: fromJsonArray<string>(profile.dataSkillsJson),
    aiMlExperience: fromJsonArray<string>(profile.aiMlExperienceJson),
    leadership: fromJsonArray<string>(profile.leadershipJson),
    companiesPrioritize: fromJsonArray<string>(profile.companiesPrioritizeJson),
    companiesExclude: fromJsonArray<string>(profile.companiesExcludeJson),
  }
}

export function buildScoringJob(job: Job, company: Company | null): ScoringJob {
  return {
    title: job.title,
    titleFamily: job.titleFamily,
    seniority: job.seniority,
    companyName: job.companyName,
    location: job.location ?? undefined,
    remoteStatus: job.remoteStatus,
    countries: fromJsonArray<string>(job.countriesJson),
    salaryMin: job.salaryMin ?? undefined,
    salaryMax: job.salaryMax ?? undefined,
    salaryCurrency: job.salaryCurrency ?? undefined,
    compConfidence: job.compConfidence as "known" | "unknown",
    datePosted: job.datePosted ?? undefined,
    requirements: {
      requiredQualifications: fromJsonArray<string>(job.requiredQualificationsJson),
      preferredQualifications: fromJsonArray<string>(job.preferredQualificationsJson),
      responsibilities: fromJsonArray<string>(job.responsibilitiesJson),
      requiredSkills: fromJsonArray<string>(job.requiredSkillsJson),
      preferredSkills: fromJsonArray<string>(job.preferredSkillsJson),
      industryExperience: fromJsonArray<string>(job.industryExperienceJson),
      educationRequirements: job.educationRequirements ?? undefined,
      yearsExperienceMin: job.yearsExperienceMin ?? undefined,
      yearsExperienceMax: job.yearsExperienceMax ?? undefined,
      techRequirements: fromJsonArray<string>(job.techRequirementsJson),
      methodologies: fromJsonArray<string>(job.methodologiesJson),
      leadershipRequirements: job.leadershipRequirements ?? undefined,
      domainRequirements: fromJsonArray<string>(job.domainRequirementsJson),
      workAuthRequirements: job.workAuthRequirements ?? undefined,
      travelRequirements: job.travelRequirements ?? undefined,
      keywords: fromJsonArray<string>(job.keywordsJson),
      atsKeywords: fromJsonArray<string>(job.atsKeywordsJson),
    } satisfies JobRequirements,
    companyReputationHint: company?.reputationScore ?? undefined,
    companySizeHint: company?.sizeHint ?? undefined,
    fundingStatusHint: company?.fundingStatus ?? undefined,
  }
}

async function buildEvidenceSummary(profileId: string, job: Job): Promise<ScoringEvidenceSummary> {
  const evidence = await prisma.careerEvidence.findMany({ where: { profileId, isVerified: true } })
  const jobTermsLower = [job.titleFamily, job.title, ...fromJsonArray<string>(job.keywordsJson)].join(" ").toLowerCase()
  const tagCounts: Record<string, number> = {}
  for (const item of evidence) {
    const tags = fromJsonArray<string>(item.tagsJson)
    for (const tag of tags) {
      if (jobTermsLower.includes(tag.toLowerCase())) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }
  }
  return { tagCounts, totalCount: evidence.length }
}

/** Scores one job and upserts its JobScore row. Returns the persisted score row's plain fields. */
export async function scoreJobById(jobId: string, profileId?: string) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { company: true } })
  const profile = profileId
    ? await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profileId } })
    : await prisma.candidateProfile.findFirstOrThrow()

  const settings = await getSettings()
  const scoringProfile = buildScoringProfile(profile)
  const scoringJob = buildScoringJob(job, job.company)
  const evidenceSummary = await buildEvidenceSummary(profile.id, job)

  const fit = scoreFit(scoringProfile, evidenceSummary, scoringJob, settings.fitWeights, settings.fitThresholds)
  const quality = scoreQuality(scoringJob)
  const priority = scorePriority(scoringProfile, scoringJob, fit, quality, settings.priorityWeights)

  const reasons = [...fit.reasons, ...quality.reasons]
  const concerns = [...fit.concerns, ...quality.concerns]

  const saved = await prisma.jobScore.upsert({
    where: { jobId },
    create: {
      jobId,
      fitScore: fit.fitScore,
      fitBreakdownJson: toJson(fit.breakdown),
      fitBand: fit.fitBand,
      qualityScore: quality.qualityScore,
      qualityBreakdownJson: toJson(quality.breakdown),
      priorityScore: priority.priorityScore,
      priorityBreakdownJson: toJson(priority.breakdown),
      reasonsJson: toJson(reasons),
      concernsJson: toJson(concerns),
    },
    update: {
      fitScore: fit.fitScore,
      fitBreakdownJson: toJson(fit.breakdown),
      fitBand: fit.fitBand,
      qualityScore: quality.qualityScore,
      qualityBreakdownJson: toJson(quality.breakdown),
      priorityScore: priority.priorityScore,
      priorityBreakdownJson: toJson(priority.breakdown),
      reasonsJson: toJson(reasons),
      concernsJson: toJson(concerns),
      scoredAt: new Date(),
    },
  })

  await audit("job.scored", "Job", jobId, {
    fitScore: fit.fitScore,
    fitBand: fit.fitBand,
    qualityScore: quality.qualityScore,
    priorityScore: priority.priorityScore,
  })

  return saved
}

export function parseJobScore(score: {
  fitScore: number
  fitBreakdownJson: string
  fitBand: string
  qualityScore: number
  qualityBreakdownJson: string
  priorityScore: number
  priorityBreakdownJson: string
  reasonsJson: string
  concernsJson: string
  scoredAt: Date
}) {
  return {
    fitScore: score.fitScore,
    fitBand: score.fitBand,
    fitBreakdown: fromJson(score.fitBreakdownJson, {}),
    qualityScore: score.qualityScore,
    qualityBreakdown: fromJson(score.qualityBreakdownJson, {}),
    priorityScore: score.priorityScore,
    priorityBreakdown: fromJson(score.priorityBreakdownJson, {}),
    reasons: fromJsonArray<string>(score.reasonsJson),
    concerns: fromJsonArray<string>(score.concernsJson),
    scoredAt: score.scoredAt,
  }
}
