import { getAiProvider } from "@/lib/ai/provider"
import { JobRequirementsSchema, type JobRequirements } from "@/lib/types/job"

/**
 * Job Description Analysis (brief §6): turns raw description text into the
 * structured requirement fields used by scoring, CV tailoring, and ATS
 * analysis. Works fully offline via deterministic heuristics (so the app
 * never depends on an AI key to function); uses the configured AI provider
 * for materially better extraction when one is available, always falling
 * back to the heuristic path on any failure.
 */
export async function analyzeJobDescription(description: string, title: string): Promise<JobRequirements> {
  const provider = await getAiProvider()
  if (provider.id !== "null") {
    try {
      return await provider.complete({
        system:
          "You extract structured hiring requirements from a job description. Only use information present in the " +
          "text. Classify each requirement as required, preferred, or a general responsibility based on the language " +
          "used (e.g. 'must have' / 'required' vs 'nice to have' / 'preferred' / 'bonus'). Never invent a requirement " +
          "that isn't in the text.",
        prompt: `Job title: ${title}\n\nJob description:\n${description.slice(0, 12000)}`,
        schema: JobRequirementsSchema,
        temperature: 0,
      })
    } catch {
      // fall through to heuristic
    }
  }
  return heuristicExtract(description)
}

const REQUIRED_CUES = /\b(required|must have|you have|you must|minimum qualifications|basic qualifications)\b/i
const PREFERRED_CUES = /\b(preferred|nice to have|bonus|plus|ideally|desirable)\b/i
const RESPONSIBILITY_CUES = /\b(you will|responsibilities|you'll|role involves|day.?to.?day)\b/i

const TECH_KEYWORDS = [
  "SQL", "Python", "R", "Excel", "Tableau", "Looker", "Amplitude", "Mixpanel", "Segment",
  "Figma", "Jira", "Confluence", "API", "REST", "GraphQL", "AWS", "GCP", "Azure",
  "Kubernetes", "Docker", "AI", "ML", "LLM", "GenAI", "Generative AI", "NLP",
  "A/B testing", "experimentation", "Salesforce", "HubSpot", "Snowflake", "dbt",
]
const METHODOLOGY_KEYWORDS = [
  "Agile", "Scrum", "Kanban", "Lean", "Design thinking", "OKR", "OKRs", "Jobs to be done",
  "JTBD", "Dual-track agile", "Continuous discovery", "RICE", "Kano",
]
const LEADERSHIP_KEYWORDS = [
  "manage a team", "managing a team", "line management", "people manager", "direct reports",
  "mentor", "mentoring", "cross-functional leadership", "stakeholder management",
]
const DOMAIN_KEYWORDS = [
  "fintech", "healthtech", "healthcare", "e-commerce", "ecommerce", "marketplace", "SaaS",
  "developer tools", "devtools", "logistics", "edtech", "insurtech", "proptech", "gaming",
  "energy", "climate", "payments", "banking", "insurance", "government", "defense", "media",
  "adtech", "cybersecurity", "biotech", "AI infrastructure",
]

function classifyLines(description: string): { required: string[]; preferred: string[]; responsibilities: string[] } {
  const lines = description
    .split(/\n|(?<=[.;])\s+(?=[A-Z])/)
    .map((l) => l.trim())
    .filter((l) => l.length > 12 && l.length < 400)

  let currentSection: "required" | "preferred" | "responsibilities" | null = null
  const required: string[] = []
  const preferred: string[] = []
  const responsibilities: string[] = []

  for (const line of lines) {
    if (REQUIRED_CUES.test(line)) currentSection = "required"
    else if (PREFERRED_CUES.test(line)) currentSection = "preferred"
    else if (RESPONSIBILITY_CUES.test(line)) currentSection = "responsibilities"

    if (REQUIRED_CUES.test(line)) required.push(line)
    else if (PREFERRED_CUES.test(line)) preferred.push(line)
    else if (RESPONSIBILITY_CUES.test(line)) responsibilities.push(line)
    else if (currentSection === "required") required.push(line)
    else if (currentSection === "preferred") preferred.push(line)
    else if (currentSection === "responsibilities") responsibilities.push(line)
  }

  return { required: dedupe(required), preferred: dedupe(preferred), responsibilities: dedupe(responsibilities) }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr)).slice(0, 25)
}

function extractYearsRange(description: string): { min?: number; max?: number } {
  const matches = [...description.matchAll(/(\d{1,2})\s*\+?\s*(?:-|to)?\s*(\d{1,2})?\s*\+?\s*years?/gi)]
  if (!matches.length) return {}
  const values: number[] = []
  for (const m of matches) {
    if (m[1]) values.push(Number(m[1]))
    if (m[2]) values.push(Number(m[2]))
  }
  if (!values.length) return {}
  return { min: Math.min(...values), max: Math.max(...values) }
}

function matchKeywords(description: string, list: string[]): string[] {
  const lower = description.toLowerCase()
  return list.filter((k) => lower.includes(k.toLowerCase()))
}

const WORK_AUTH_CUES = [
  /must be (?:a )?(?:us |u\.s\. )?citizen/i,
  /security clearance/i,
  /ts\/sci/i,
  /work authorization/i,
  /visa sponsorship/i,
  /do not sponsor/i,
  /right to work/i,
  /legally authorized to work/i,
]

function extractWorkAuth(description: string): string | undefined {
  // Return the *whole sentence* a work-authorization cue appears in, never a
  // substring starting mid-sentence — otherwise a leading negation like "no
  // work authorization restrictions" gets truncated into something that
  // reads as the opposite of what the posting says.
  const sentences = description.split(/(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    if (WORK_AUTH_CUES.some((p) => p.test(sentence))) return sentence.trim()
  }
  return undefined
}

function heuristicExtract(description: string): JobRequirements {
  const { required, preferred, responsibilities } = classifyLines(description)
  const years = extractYearsRange(description)
  const keywords = [
    ...matchKeywords(description, TECH_KEYWORDS),
    ...matchKeywords(description, METHODOLOGY_KEYWORDS),
    ...matchKeywords(description, DOMAIN_KEYWORDS),
  ]

  return {
    requiredQualifications: required,
    preferredQualifications: preferred,
    responsibilities,
    requiredSkills: matchKeywords(description, [...TECH_KEYWORDS, ...METHODOLOGY_KEYWORDS]),
    preferredSkills: [],
    industryExperience: matchKeywords(description, DOMAIN_KEYWORDS),
    yearsExperienceMin: years.min,
    yearsExperienceMax: years.max,
    techRequirements: matchKeywords(description, TECH_KEYWORDS),
    methodologies: matchKeywords(description, METHODOLOGY_KEYWORDS),
    leadershipRequirements: matchKeywords(description, LEADERSHIP_KEYWORDS).join("; ") || undefined,
    domainRequirements: matchKeywords(description, DOMAIN_KEYWORDS),
    workAuthRequirements: extractWorkAuth(description),
    keywords: dedupe(keywords),
    atsKeywords: dedupe(keywords),
  }
}

/** Exported for the conflicting-requirements test scenario (brief §53). */
export function detectConflictingExperienceRange(req: JobRequirements): string | undefined {
  if (req.yearsExperienceMin !== undefined && req.yearsExperienceMax !== undefined) {
    if (req.yearsExperienceMax - req.yearsExperienceMin >= 6) {
      return `Job description states experience requirements ranging from ${req.yearsExperienceMin} to ${req.yearsExperienceMax} years — likely conflicting or poorly specified; treat with caution.`
    }
  }
  return undefined
}
