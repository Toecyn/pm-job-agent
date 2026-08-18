import { describe, it, expect } from "vitest"
import { scoreFit } from "@/lib/scoring/fit"
import { scoreQuality } from "@/lib/scoring/quality"
import { scorePriority } from "@/lib/scoring/priority"
import { DEFAULT_FIT_THRESHOLDS, DEFAULT_FIT_WEIGHTS, DEFAULT_PRIORITY_WEIGHTS } from "@/lib/types/scoring"
import type { ScoringJob, ScoringProfile } from "@/lib/scoring/types"

function baseProfile(overrides: Partial<ScoringProfile> = {}): ScoringProfile {
  return {
    yearsExperience: 8,
    currentRole: "Senior Product Manager",
    targetSeniority: ["mid", "senior"],
    preferredCountries: ["Nigeria", "United Kingdom"],
    preferredCities: ["Lagos", "London"],
    workModePreference: "remote",
    willingToRelocate: false,
    workAuthorization: { country: "Nigeria", status: "citizen", sponsorshipNeeded: true },
    preferredComp: { min: 90000, max: 130000, currency: "USD", period: "year" },
    industries: ["fintech", "AI infrastructure"],
    targetIndustries: ["fintech", "AI infrastructure"],
    productAreas: ["AI/ML platforms", "payments"],
    technicalSkills: ["SQL", "Python", "API design"],
    pmSkills: ["Roadmapping", "A/B testing", "Agile", "stakeholder management", "experimentation"],
    dataSkills: ["SQL", "Amplitude"],
    aiMlExperience: ["LLM-powered features", "GenAI product design"],
    leadership: ["Managed 2 associate PMs"],
    companiesPrioritize: [],
    companiesExclude: [],
    ...overrides,
  }
}

function baseJob(overrides: Partial<ScoringJob> = {}): ScoringJob {
  return {
    title: "Senior AI Product Manager",
    titleFamily: "ai_product_manager",
    seniority: "senior",
    companyName: "Northwind Financial",
    location: "Remote",
    remoteStatus: "remote",
    countries: [],
    salaryMin: 150000,
    salaryMax: 190000,
    salaryCurrency: "USD",
    compConfidence: "known",
    datePosted: new Date(),
    requirements: {
      requiredQualifications: ["5+ years of product management experience"],
      preferredQualifications: ["experience in fintech"],
      responsibilities: [],
      requiredSkills: ["A/B testing", "experimentation"],
      preferredSkills: [],
      industryExperience: ["fintech"],
      yearsExperienceMin: 5,
      techRequirements: ["SQL"],
      methodologies: [],
      domainRequirements: ["fintech"],
      keywords: ["ai", "genai", "fintech"],
      atsKeywords: ["ai", "genai", "fintech"],
    },
    ...overrides,
  }
}

const emptyEvidence = { tagCounts: {}, totalCount: 0 }

describe("Fit scoring (brief §7)", () => {
  it("scores a strong match highly and explains why", () => {
    const result = scoreFit(baseProfile(), emptyEvidence, baseJob(), DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    expect(result.fitScore).toBeGreaterThanOrEqual(70)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it("does not auto-zero the score just because one preferred qualification is missing", () => {
    const job = baseJob({
      requirements: {
        ...baseJob().requirements,
        preferredQualifications: ["experience with a technology the candidate has never touched"],
      },
    })
    const result = scoreFit(baseProfile(), emptyEvidence, job, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    // preferredQualificationMatch has a floor of 40 — missing a "nice to have" should never crater the score.
    expect(result.breakdown.preferredQualificationMatch).toBeGreaterThanOrEqual(40)
    expect(result.fitScore).toBeGreaterThan(40)
  })

  it("flags a missing REQUIRED qualification as a concern without zeroing the whole score", () => {
    const job = baseJob({
      requirements: {
        ...baseJob().requirements,
        requiredQualifications: ["Must have 10 years of experience in nuclear submarine logistics"],
      },
    })
    const result = scoreFit(baseProfile(), emptyEvidence, job, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    expect(result.breakdown.missingRequiredQualifications.length).toBe(1)
    expect(result.concerns.some((c) => c.includes("required qualification"))).toBe(true)
    expect(result.fitScore).toBeGreaterThan(0) // never auto-rejected outright
  })

  it("heavily penalizes a role requiring US citizenship/security clearance for a candidate without it", () => {
    const job = baseJob({
      requirements: {
        ...baseJob().requirements,
        workAuthRequirements: "Must be a US citizen with an active security clearance.",
      },
    })
    const result = scoreFit(baseProfile(), emptyEvidence, job, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    expect(result.breakdown.workAuthorizationMatch).toBeLessThan(20)
    expect(result.concerns.some((c) => /clearance|citizen/i.test(c))).toBe(true)
  })

  it("does not falsely flag a role that explicitly has no work-authorization restrictions", () => {
    const job = baseJob({
      requirements: {
        ...baseJob().requirements,
        workAuthRequirements: "Remote-friendly worldwide; no work authorization restrictions — we hire via EOR globally.",
      },
    })
    const result = scoreFit(baseProfile(), emptyEvidence, job, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    expect(result.breakdown.workAuthorizationMatch).toBeGreaterThanOrEqual(90)
    expect(result.concerns.some((c) => /concern.*work/i.test(c))).toBe(false)
  })

  it("scores a poor-fit role (wrong function, wrong seniority) low", () => {
    const job = baseJob({
      title: "Engineering Manager, Mobile Platform",
      titleFamily: "other_related",
      seniority: "lead",
      requirements: {
        ...baseJob().requirements,
        requiredSkills: ["Swift", "Kotlin", "CI/CD"],
        techRequirements: ["Swift", "Kotlin"],
        domainRequirements: [],
        industryExperience: [],
      },
    })
    const profile = baseProfile({ targetSeniority: ["mid", "senior"] })
    const result = scoreFit(profile, emptyEvidence, job, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    expect(result.fitScore).toBeLessThan(70)
  })

  it("assigns fit bands consistent with configured thresholds", () => {
    const result = scoreFit(baseProfile(), emptyEvidence, baseJob(), DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_THRESHOLDS)
    if (result.fitScore >= DEFAULT_FIT_THRESHOLDS.exceptional) expect(result.fitBand).toBe("exceptional")
    else if (result.fitScore >= DEFAULT_FIT_THRESHOLDS.strong) expect(result.fitBand).toBe("strong")
  })
})

describe("Job Quality scoring (brief §8) — independent from fit", () => {
  it("produces a quality score that does not depend on the candidate profile", () => {
    const job = baseJob()
    const result = scoreQuality(job)
    expect(result.qualityScore).toBeGreaterThanOrEqual(0)
    expect(result.qualityScore).toBeLessThanOrEqual(100)
  })

  it("flags unknown compensation as a concern rather than inventing a number", () => {
    const job = baseJob({ compConfidence: "unknown", salaryMin: undefined, salaryMax: undefined })
    const result = scoreQuality(job)
    expect(result.concerns.some((c) => /salary/i.test(c))).toBe(true)
  })
})

describe("Application Priority scoring (brief §9, §40)", () => {
  it("ranks a recent, high-fit, high-quality job above an older, lower-fit one", () => {
    const profile = baseProfile()
    const recentJob = baseJob({ datePosted: new Date(Date.now() - 2 * 3600_000) })
    const oldJob = baseJob({ datePosted: new Date(Date.now() - 30 * 24 * 3600_000), requirements: { ...baseJob().requirements, requiredQualifications: ["Something totally unrelated"] } })

    const fitRecent = scoreFit(profile, emptyEvidence, recentJob)
    const qualityRecent = scoreQuality(recentJob)
    const priorityRecent = scorePriority(profile, recentJob, fitRecent, qualityRecent, DEFAULT_PRIORITY_WEIGHTS)

    const fitOld = scoreFit(profile, emptyEvidence, oldJob)
    const qualityOld = scoreQuality(oldJob)
    const priorityOld = scorePriority(profile, oldJob, fitOld, qualityOld, DEFAULT_PRIORITY_WEIGHTS)

    expect(priorityRecent.priorityScore).toBeGreaterThan(priorityOld.priorityScore)
  })
})
