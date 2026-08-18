import { z } from "zod"
import { EvidenceType, WorkModePreference } from "./enums"

export const WorkAuthorizationSchema = z.object({
  country: z.string(),
  status: z.string(), // e.g. "citizen", "permanent_resident", "visa_required", "unknown"
  sponsorshipNeeded: z.boolean().default(false),
  details: z.string().optional(),
})
export type WorkAuthorization = z.infer<typeof WorkAuthorizationSchema>

export const CompensationExpectationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  currency: z.string().default("USD"),
  period: z.enum(["year", "month", "hour"]).default("year"),
})
export type CompensationExpectation = z.infer<typeof CompensationExpectationSchema>

export const EducationEntrySchema = z.object({
  institution: z.string(),
  credential: z.string(),
  field: z.string().optional(),
  graduationYear: z.number().optional(),
})

export const CertificationEntrySchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  year: z.number().optional(),
})

/** Input shape for creating/editing a candidate profile via onboarding or Settings. */
export const CandidateProfileInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),

  workAuthorization: WorkAuthorizationSchema.optional(),
  preferredCountries: z.array(z.string()).default([]),
  preferredCities: z.array(z.string()).default([]),
  workModePreference: WorkModePreference.default("any"),
  willingToRelocate: z.boolean().default(false),

  yearsExperience: z.number().min(0).optional(),
  currentRole: z.string().optional(),
  currentCompany: z.string().optional(),
  previousRoles: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  productAreas: z.array(z.string()).default([]),

  technicalSkills: z.array(z.string()).default([]),
  pmSkills: z.array(z.string()).default([]),
  dataSkills: z.array(z.string()).default([]),
  aiMlExperience: z.array(z.string()).default([]),
  leadership: z.array(z.string()).default([]),

  education: z.array(EducationEntrySchema).default([]),
  certifications: z.array(CertificationEntrySchema).default([]),

  preferredComp: CompensationExpectationSchema.optional(),
  noticePeriodDays: z.number().optional(),
  availability: z.string().optional(),

  targetSeniority: z.array(z.string()).default(["mid", "senior"]),
  targetCompanySize: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
  companiesPrioritize: z.array(z.string()).default([]),
  companiesExclude: z.array(z.string()).default([]),
})
export type CandidateProfileInput = z.infer<typeof CandidateProfileInputSchema>

export const CareerEvidenceMetricSchema = z.object({
  label: z.string(),
  value: z.string(), // kept as string so we never silently coerce/round a user's real number
  unit: z.string().optional(),
})

export const CareerEvidenceInputSchema = z.object({
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  startDate: z.string().optional(), // ISO date
  endDate: z.string().optional(), // ISO date, absent = current
  evidenceType: EvidenceType,
  title: z.string().min(1),
  description: z.string().min(1),
  metrics: z.array(CareerEvidenceMetricSchema).default([]),
  tags: z.array(z.string()).default([]),
  isVerified: z.boolean().default(true),
})
export type CareerEvidenceInput = z.infer<typeof CareerEvidenceInputSchema>
