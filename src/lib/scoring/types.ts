import type { JobRequirements } from "@/lib/types/job"
import type { WorkAuthorization, CompensationExpectation } from "@/lib/types/profile"

/** Decoupled from Prisma rows so the scoring engines are pure and unit-testable. */
export interface ScoringProfile {
  yearsExperience?: number
  currentRole?: string
  targetSeniority: string[]
  preferredCountries: string[]
  preferredCities: string[]
  workModePreference: string
  willingToRelocate: boolean
  workAuthorization?: WorkAuthorization
  preferredComp?: CompensationExpectation
  industries: string[]
  targetIndustries: string[]
  productAreas: string[]
  technicalSkills: string[]
  pmSkills: string[]
  dataSkills: string[]
  aiMlExperience: string[]
  leadership: string[]
  companiesPrioritize: string[]
  companiesExclude: string[]
}

export interface ScoringEvidenceSummary {
  tagCounts: Record<string, number>
  totalCount: number
}

export interface ScoringJob {
  title: string
  titleFamily: string
  seniority: string
  companyName: string
  location?: string
  remoteStatus: string
  countries: string[]
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  compConfidence: "known" | "unknown"
  datePosted?: Date
  requirements: JobRequirements
  companyReputationHint?: number // 0-100, from Company.reputationScore if researched
  companySizeHint?: string
  fundingStatusHint?: string
}
