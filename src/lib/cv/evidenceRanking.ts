import type { CareerEvidence } from "@prisma/client"
import { fromJsonArray } from "@/lib/utils/json"
import type { JobRequirements } from "@/lib/types/job"

export interface RankedEvidence {
  evidence: CareerEvidence
  relevance: number
}

/**
 * Ranks a candidate's career evidence by relevance to a specific job so the
 * CV Tailoring Agent can pick the strongest truthful evidence first (brief
 * §5/§10) instead of dumping the whole career history into every CV.
 */
export function rankEvidenceForJob(
  evidence: CareerEvidence[],
  job: { titleFamily: string; title: string; requirements: JobRequirements }
): RankedEvidence[] {
  const jobTerms = new Set(
    [
      job.titleFamily.replace(/_/g, " "),
      job.title,
      ...job.requirements.requiredSkills,
      ...job.requirements.preferredSkills,
      ...job.requirements.techRequirements,
      ...job.requirements.methodologies,
      ...job.requirements.industryExperience,
      ...job.requirements.domainRequirements,
      ...job.requirements.keywords,
    ]
      .join(" ")
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) ?? []
  )

  const scored = evidence.map((e) => {
    const tags = fromJsonArray<string>(e.tagsJson)
    const evidenceTerms = new Set(
      [e.title, e.description, ...tags, e.evidenceType].join(" ").toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
    )
    let hits = 0
    for (const term of evidenceTerms) if (jobTerms.has(term)) hits++
    const relevance = hits + tags.length * 0.25 // tag-rich evidence gets a small baseline boost
    return { evidence: e, relevance }
  })

  return scored.sort((a, b) => b.relevance - a.relevance)
}
