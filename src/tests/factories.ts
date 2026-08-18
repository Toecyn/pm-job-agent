import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { encryptJson } from "@/lib/security/crypto"
import type { Prisma } from "@prisma/client"

let counter = 0
function uniqueId(): string {
  counter += 1
  return `${Date.now()}-${counter}`
}

export async function createTestProfile(overrides: Partial<Prisma.CandidateProfileUncheckedCreateInput> = {}) {
  return prisma.candidateProfile.create({
    data: {
      email: `candidate-${uniqueId()}@example.com`,
      fullName: "Test Candidate",
      location: "Lagos, Nigeria",
      yearsExperience: 8,
      currentRole: "Senior Product Manager",
      workModePreference: "remote",
      willingToRelocate: false,
      workAuthorizationEnc: encryptJson({ country: "Nigeria", status: "citizen", sponsorshipNeeded: true }),
      preferredCompEnc: encryptJson({ min: 90000, max: 130000, currency: "USD", period: "year" }),
      preferredCountriesJson: toJson(["Nigeria", "United Kingdom"]),
      preferredCitiesJson: toJson(["Lagos", "London"]),
      targetSeniorityJson: toJson(["mid", "senior"]),
      industriesJson: toJson(["fintech", "AI infrastructure"]),
      targetIndustriesJson: toJson(["fintech", "AI infrastructure"]),
      pmSkillsJson: toJson(["Roadmapping", "A/B testing", "Agile", "stakeholder management"]),
      technicalSkillsJson: toJson(["SQL", "Python", "API design"]),
      dataSkillsJson: toJson(["SQL", "Amplitude"]),
      aiMlExperienceJson: toJson(["LLM-powered features", "GenAI product design"]),
      leadershipJson: toJson(["Managed 2 associate PMs"]),
      onboardingComplete: true,
      ...overrides,
    },
  })
}

export async function createTestEvidence(profileId: string, overrides: Partial<Prisma.CareerEvidenceUncheckedCreateInput> = {}) {
  return prisma.careerEvidence.create({
    data: {
      profileId,
      company: "Zenith Data Systems",
      roleTitle: "Senior Product Manager",
      startDate: new Date("2022-03-01"),
      evidenceType: "ai",
      title: "Shipped GenAI-powered underwriting assistant",
      description: "Led discovery and delivery of an LLM-powered assistant for loan officers, from framing through GA.",
      metricsJson: toJson([{ label: "Manual review time reduced", value: "38", unit: "%" }]),
      tagsJson: toJson(["ai", "genai", "fintech", "delivery"]),
      ...overrides,
    },
  })
}

export async function createTestJob(overrides: Partial<Prisma.JobUncheckedCreateInput> = {}) {
  const id = uniqueId()
  return prisma.job.create({
    data: {
      title: "Senior AI Product Manager",
      normalizedTitle: "senior ai product manager",
      titleFamily: "ai_product_manager",
      seniority: "senior",
      companyName: `Test Co ${id}`,
      location: "Remote",
      remoteStatus: "remote",
      countriesJson: toJson([]),
      employmentType: "full_time",
      applicationUrl: `https://example.com/jobs/${id}`,
      originalUrl: `https://example.com/jobs/${id}`,
      source: "greenhouse",
      sourceJobId: id,
      datePosted: new Date(),
      datePostedConfidence: "known",
      description: "Senior AI Product Manager role requiring 5+ years of product management experience.",
      requiredQualificationsJson: toJson(["5+ years of product management experience"]),
      preferredQualificationsJson: toJson([]),
      responsibilitiesJson: toJson([]),
      requiredSkillsJson: toJson(["A/B testing"]),
      preferredSkillsJson: toJson([]),
      industryExperienceJson: toJson(["fintech"]),
      techRequirementsJson: toJson(["SQL"]),
      methodologiesJson: toJson([]),
      domainRequirementsJson: toJson(["fintech"]),
      keywordsJson: toJson(["ai", "genai", "fintech"]),
      atsKeywordsJson: toJson(["ai", "genai", "fintech"]),
      yearsExperienceMin: 5,
      compConfidence: "unknown",
      dedupFingerprint: `testco${id}::ai_product_manager::remote`,
      ...overrides,
    },
  })
}
