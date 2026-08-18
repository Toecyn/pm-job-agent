export interface CvExperienceEntry {
  company: string
  roleTitle: string
  startDate?: string
  endDate?: string // absent = current
  bullets: { text: string; sourceEvidenceIds: string[]; primaryEvidenceId: string; verifierPassed: boolean; confidence: "verified" | "inferred" }[]
}

export interface CvContent {
  fullName: string
  contact: { email: string; phone?: string; location?: string; linkedinUrl?: string; portfolioUrl?: string; githubUrl?: string }
  summary: string
  coreCompetencies: string[]
  skills: { technical: string[]; pm: string[]; data: string[]; ai: string[]; leadership: string[] }
  experience: CvExperienceEntry[]
  education: { institution: string; credential: string; field?: string; graduationYear?: number }[]
  certifications: { name: string; issuer?: string; year?: number }[]
  variantKey: string
  variantLabel: string
}
