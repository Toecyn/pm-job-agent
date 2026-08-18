import { z } from "zod"
import { prisma } from "@/lib/db/client"
import { getAiProvider } from "@/lib/ai/provider"
import { verifyStatementAgainstEvidence } from "@/lib/cv/verifier"
import { rankEvidenceForJob } from "@/lib/cv/evidenceRanking"
import { buildScoringJob } from "@/lib/scoring/scoreJob"
import { getSettings } from "@/lib/config/settings"
import { audit } from "@/lib/audit/logger"
import type { CareerEvidence } from "@prisma/client"

const LetterSchema = z.object({ paragraphs: z.array(z.string()).min(2).max(4) })

function mentionsCoverLetterRequirement(description: string): boolean {
  return /cover letter/i.test(description)
}

function evidenceCorpus(evidence: CareerEvidence[]): string {
  return evidence.map((e) => `${e.title}. ${e.description}`).join(" ")
}

function templateLetter(params: {
  fullName: string
  currentRole?: string
  companyName: string
  jobTitle: string
  topEvidence: CareerEvidence[]
  domainTerms: string[]
}): string[] {
  const { currentRole, companyName, jobTitle, topEvidence, domainTerms } = params
  const p1 =
    `As a ${currentRole ?? "product management professional"}, I'm applying for the ${jobTitle} role at ${companyName}` +
    `${domainTerms.length ? `, drawn to your work in ${domainTerms.slice(0, 2).join(" and ")}` : ""}.`
  const p2 = topEvidence
    .slice(0, 2)
    .map((e) => `${e.title}: ${e.description}`)
    .join(" ")
  const p3 = `I'd welcome the chance to bring this experience to ${companyName} and discuss how it applies to your roadmap.`
  return [p1, p2, p3].filter(Boolean)
}

export interface GenerateCoverLetterResult {
  coverLetterId: string | null
  content: string | null
  wasGenerated: boolean
  reason: string
}

export async function generateCoverLetter(jobId: string, profileId?: string, force = false): Promise<GenerateCoverLetterResult> {
  const settings = await getSettings()
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { company: true } })
  const profile = profileId
    ? await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profileId } })
    : await prisma.candidateProfile.findFirstOrThrow()

  const required = mentionsCoverLetterRequirement(job.description)
  if (!force) {
    if (settings.coverLetterPreference === "never") {
      return { coverLetterId: null, content: null, wasGenerated: false, reason: "Cover letters disabled in Settings." }
    }
    if (settings.coverLetterPreference === "if_required" && !required) {
      return { coverLetterId: null, content: null, wasGenerated: false, reason: "Job does not appear to require a cover letter." }
    }
  }

  const evidence = await prisma.careerEvidence.findMany({ where: { profileId: profile.id, isVerified: true } })
  const scoringJob = buildScoringJob(job, job.company)
  const ranked = rankEvidenceForJob(evidence, { titleFamily: job.titleFamily, title: job.title, requirements: scoringJob.requirements })
  const topEvidence = ranked.slice(0, 3).map((r) => r.evidence)

  const provider = await getAiProvider()
  let paragraphs: string[]

  if (provider.id === "null") {
    paragraphs = templateLetter({
      fullName: profile.fullName,
      currentRole: profile.currentRole ?? undefined,
      companyName: job.companyName,
      jobTitle: job.title,
      topEvidence,
      domainTerms: scoringJob.requirements.domainRequirements,
    })
  } else {
    try {
      const result = await provider.complete({
        system:
          "Write a concise, specific cover letter (2-4 short paragraphs, no greeting/signature). Connect the " +
          "candidate's real experience to the company's product and the job's actual requirements. Never write " +
          'generic filler like "I am excited to apply". Use ONLY facts from the evidence provided — never invent ' +
          "metrics, employers, or experience.",
        prompt:
          `Job: ${job.title} at ${job.companyName}\nJob description excerpt:\n${job.description.slice(0, 2000)}\n\n` +
          `Candidate current role: ${profile.currentRole ?? "unknown"}\nRelevant evidence:\n${topEvidence.map((e) => `- ${e.title}: ${e.description}`).join("\n")}`,
        schema: LetterSchema,
        temperature: 0.5,
      })
      const verification = verifyStatementAgainstEvidence(result.paragraphs.join(" "), evidenceCorpus(topEvidence))
      paragraphs = verification.passed
        ? result.paragraphs
        : templateLetter({
            fullName: profile.fullName,
            currentRole: profile.currentRole ?? undefined,
            companyName: job.companyName,
            jobTitle: job.title,
            topEvidence,
            domainTerms: scoringJob.requirements.domainRequirements,
          })
    } catch {
      paragraphs = templateLetter({
        fullName: profile.fullName,
        currentRole: profile.currentRole ?? undefined,
        companyName: job.companyName,
        jobTitle: job.title,
        topEvidence,
        domainTerms: scoringJob.requirements.domainRequirements,
      })
    }
  }

  const content = paragraphs.join("\n\n")
  const coverLetter = await prisma.coverLetter.create({
    data: { jobId: job.id, profileId: profile.id, content, wasNeeded: required || force },
  })

  await audit("coverletter.generated", "CoverLetter", coverLetter.id, { jobId, required, forced: force })

  return { coverLetterId: coverLetter.id, content, wasGenerated: true, reason: required ? "Job requires a cover letter." : "Generated by request." }
}
