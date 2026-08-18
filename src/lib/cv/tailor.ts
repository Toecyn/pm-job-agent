import { prisma } from "@/lib/db/client"
import { fromJsonArray, toJson } from "@/lib/utils/json"
import { buildScoringProfile, buildScoringJob } from "@/lib/scoring/scoreJob"
import { selectBaseVariant } from "./variants"
import { rankEvidenceForJob } from "./evidenceRanking"
import { generateBullet } from "./generateBullets"
import { generateSummary } from "./summary"
import { renderCvText } from "./render"
import { analyzeAts } from "./ats"
import type { CvContent, CvExperienceEntry } from "./types"
import { audit } from "@/lib/audit/logger"
import type { CareerEvidence } from "@prisma/client"

const VARIANT_LABELS: Record<string, string> = {
  master: "Product Management",
  general_pm: "Product Management",
  senior_pm: "Senior Product Leadership",
  ai_pm: "AI/GenAI Product Management",
  data_pm: "Data Product Management",
  technical_pm: "Technical Product Management",
  product_strategy: "Product Strategy",
}

function reorderByRelevance(items: string[], relevantTerms: Set<string>): string[] {
  return [...items].sort((a, b) => {
    const aHit = relevantTerms.has(a.toLowerCase()) ? 1 : 0
    const bHit = relevantTerms.has(b.toLowerCase()) ? 1 : 0
    return bHit - aHit
  })
}

function groupEvidenceByRole(evidence: CareerEvidence[]) {
  const groups = new Map<string, { company: string; roleTitle: string; startDate: Date | null; endDate: Date | null; items: CareerEvidence[] }>()
  for (const e of evidence) {
    if (!e.company || !e.roleTitle) continue
    const key = `${e.company}::${e.roleTitle}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(e)
      if (e.startDate && (!existing.startDate || e.startDate < existing.startDate)) existing.startDate = e.startDate
      if (e.endDate && (!existing.endDate || e.endDate > existing.endDate)) existing.endDate = e.endDate
    } else {
      groups.set(key, { company: e.company, roleTitle: e.roleTitle, startDate: e.startDate, endDate: e.endDate, items: [e] })
    }
  }
  return Array.from(groups.values()).sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))
}

export interface TailorCvOptions {
  jobId: string
  profileId?: string
  variantKeyOverride?: string
}

export async function tailorCvForJob(opts: TailorCvOptions) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: opts.jobId }, include: { company: true } })
  const profile = opts.profileId
    ? await prisma.candidateProfile.findUniqueOrThrow({ where: { id: opts.profileId } })
    : await prisma.candidateProfile.findFirstOrThrow()
  const evidence = await prisma.careerEvidence.findMany({ where: { profileId: profile.id, isVerified: true } })

  const scoringJob = buildScoringJob(job, job.company)
  const scoringProfile = buildScoringProfile(profile)

  const variantKey = opts.variantKeyOverride ?? selectBaseVariant(job.titleFamily, job.seniority)
  const variantLabel = VARIANT_LABELS[variantKey] ?? "Product Management"

  const rankedAll = rankEvidenceForJob(evidence, { titleFamily: job.titleFamily, title: job.title, requirements: scoringJob.requirements })
  const topOverall = rankedAll.slice(0, 6).map((r) => r.evidence)

  const roleGroups = groupEvidenceByRole(evidence)
  const experience: CvExperienceEntry[] = []
  for (const group of roleGroups) {
    const ranked = rankEvidenceForJob(group.items, { titleFamily: job.titleFamily, title: job.title, requirements: scoringJob.requirements })
    const chosen = ranked.slice(0, 4)
    const bullets = await Promise.all(chosen.map((r) => generateBullet(r.evidence)))
    experience.push({
      company: group.company,
      roleTitle: group.roleTitle,
      startDate: group.startDate ? group.startDate.toISOString().slice(0, 7) : undefined,
      endDate: group.endDate ? group.endDate.toISOString().slice(0, 7) : undefined,
      bullets,
    })
  }

  const summary = await generateSummary(scoringProfile, topOverall, job.title, variantLabel)

  const relevantTerms = new Set(
    [...scoringJob.requirements.requiredSkills, ...scoringJob.requirements.preferredSkills, ...scoringJob.requirements.techRequirements, ...scoringJob.requirements.methodologies].map((s) => s.toLowerCase())
  )
  const coreCompetencies = Array.from(new Set(topOverall.flatMap((e) => fromJsonArray<string>(e.tagsJson)))).slice(0, 8)

  const cvContent: CvContent = {
    fullName: profile.fullName,
    contact: {
      email: profile.email,
      phone: profile.phone ?? undefined,
      location: profile.location ?? undefined,
      linkedinUrl: profile.linkedinUrl ?? undefined,
      portfolioUrl: profile.portfolioUrl ?? undefined,
      githubUrl: profile.githubUrl ?? undefined,
    },
    summary,
    coreCompetencies,
    skills: {
      // Order-only reshuffling toward job relevance — never adds a skill the profile doesn't already list
      // (brief §10: "Do NOT add technologies simply because they appear in the job description").
      technical: reorderByRelevance(fromJsonArray<string>(profile.technicalSkillsJson), relevantTerms),
      pm: reorderByRelevance(fromJsonArray<string>(profile.pmSkillsJson), relevantTerms),
      data: reorderByRelevance(fromJsonArray<string>(profile.dataSkillsJson), relevantTerms),
      ai: reorderByRelevance(fromJsonArray<string>(profile.aiMlExperienceJson), relevantTerms),
      leadership: fromJsonArray<string>(profile.leadershipJson),
    },
    experience,
    education: fromJsonArray(profile.educationJson),
    certifications: fromJsonArray(profile.certificationsJson),
    variantKey,
    variantLabel,
  }

  const renderedText = renderCvText(cvContent)
  const ats = analyzeAts(renderedText, scoringJob.requirements)

  const tailoredCv = await prisma.tailoredCV.create({
    data: {
      jobId: job.id,
      profileId: profile.id,
      baseVariantKey: variantKey,
      contentJson: toJson(cvContent),
      renderedText,
      atsScore: ats.score,
      atsBreakdownJson: toJson(ats),
    },
  })

  const bulletRows = experience.flatMap((exp) =>
    exp.bullets.map((b) => ({
      tailoredCvId: tailoredCv.id,
      section: `experience:${exp.company}`,
      bulletText: b.text,
      sourceEvidenceIdsJson: toJson(b.sourceEvidenceIds),
      primaryEvidenceId: b.primaryEvidenceId,
      confidence: b.confidence,
      verifierPassed: b.verifierPassed,
    }))
  )
  if (bulletRows.length) {
    await prisma.cvBulletSource.createMany({ data: bulletRows })
  }

  await audit("cv.tailored", "TailoredCV", tailoredCv.id, { jobId: job.id, variantKey, atsScore: ats.score })

  return { tailoredCv, cvContent, ats }
}
