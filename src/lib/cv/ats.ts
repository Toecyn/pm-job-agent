import type { JobRequirements } from "@/lib/types/job"

export interface AtsAnalysis {
  score: number
  keywordCoverage: number
  matchedKeywords: string[]
  missingKeywords: string[]
  skillsAlignment: number
  experienceAlignmentNote: string
  risks: string[]
}

/**
 * ATS Optimization analysis (brief §12): measures how well a tailored CV's
 * rendered text covers the job's important keywords, without ever
 * recommending keyword stuffing — the CV Tailoring Agent only ever adds a
 * keyword if it's already a truthful part of the candidate's profile/
 * evidence (brief §10's "do not add technologies simply because they
 * appear in the job description"), so this function's job is to *measure*
 * coverage, not to change the CV to chase a score.
 */
export function analyzeAts(cvText: string, requirements: JobRequirements): AtsAnalysis {
  const lowerText = cvText.toLowerCase()
  const importantKeywords = Array.from(
    new Set([...requirements.atsKeywords, ...requirements.requiredSkills, ...requirements.techRequirements, ...requirements.methodologies])
  ).filter(Boolean)

  const matched = importantKeywords.filter((k) => lowerText.includes(k.toLowerCase()))
  const missing = importantKeywords.filter((k) => !matched.includes(k))
  const keywordCoverage = importantKeywords.length ? Math.round((matched.length / importantKeywords.length) * 100) : 100

  const preferredMatched = requirements.preferredSkills.filter((k) => lowerText.includes(k.toLowerCase()))
  const skillsAlignment = requirements.preferredSkills.length
    ? Math.round((preferredMatched.length / requirements.preferredSkills.length) * 100)
    : 100

  const risks: string[] = []
  if (keywordCoverage < 50) risks.push("Low keyword coverage — the CV may not surface in ATS keyword-based searches for this role.")
  if (cvText.length < 800) risks.push("CV content is quite short — some ATS systems weight thin resumes lower.")

  const score = Math.round(keywordCoverage * 0.7 + skillsAlignment * 0.3)

  return {
    score,
    keywordCoverage,
    matchedKeywords: matched,
    missingKeywords: missing,
    skillsAlignment,
    experienceAlignmentNote:
      requirements.yearsExperienceMin !== undefined
        ? `Role expects ${requirements.yearsExperienceMin}+ years — verify this is reflected in the experience section dates.`
        : "No explicit years-of-experience requirement detected.",
    risks,
  }
}
