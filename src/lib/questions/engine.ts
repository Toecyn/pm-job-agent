import { z } from "zod"
import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { getAiProvider } from "@/lib/ai/provider"
import { classifyQuestion } from "./classify"
import { verifyStatementAgainstEvidence } from "@/lib/cv/verifier"
import { rankEvidenceForJob } from "@/lib/cv/evidenceRanking"
import { buildScoringJob } from "@/lib/scoring/scoreJob"
import { textSimilarity } from "@/lib/dedup/dedup"
import { audit } from "@/lib/audit/logger"
import type { CareerEvidence } from "@prisma/client"

const AnswerSchema = z.object({ answer: z.string() })

export interface AskInput {
  question: string
  charLimit?: number
}

export interface AnsweredQuestion {
  question: string
  answer: string | null
  isSensitive: boolean
  requiresApproval: boolean
  wasUserProvided: boolean
  sourceEvidenceIds: string[]
}

function evidenceCorpus(evidence: CareerEvidence[]): string {
  return evidence.map((e) => `${e.title}. ${e.description}`).join(" ")
}

function truncateToLimit(text: string, limit?: number): string {
  if (!limit || text.length <= limit) return text
  return text.slice(0, limit - 1).trimEnd() + "…"
}

async function findPredefinedAnswer(category: string, question: string) {
  const candidates = await prisma.predefinedAnswer.findMany({ where: { category } })
  if (!candidates.length) return null
  // Prefer the closest textual match within the category; fall back to the most recently updated.
  const scored = candidates
    .map((c) => ({ c, sim: textSimilarity(c.question, question) }))
    .sort((a, b) => b.sim - a.sim)
  return scored[0].c
}

async function findSimilarPastAnswers(question: string, excludeApplicationId: string): Promise<string[]> {
  const recent = await prisma.applicationAnswer.findMany({
    where: { applicationId: { not: excludeApplicationId }, answer: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 25,
  })
  return recent
    .filter((r) => textSimilarity(r.question, question) > 0.4)
    .slice(0, 2)
    .map((r) => r.answer!)
}

/**
 * The Application Question Engine (brief §14). For every question: classify
 * -> (sensitive: use a predefined answer or pause for the human, brief §17)
 * -> (else: pull the strongest relevant evidence and generate a truthful,
 * non-repetitive, length-limited answer, verified the same way CV bullets
 * and cover letters are).
 */
export async function answerApplicationQuestions(applicationId: string, questions: AskInput[]): Promise<AnsweredQuestion[]> {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: { include: { company: true } } },
  })
  const evidence = await prisma.careerEvidence.findMany({ where: { profileId: application.profileId, isVerified: true } })
  const scoringJob = buildScoringJob(application.job, application.job.company)
  const ranked = rankEvidenceForJob(evidence, {
    titleFamily: application.job.titleFamily,
    title: application.job.title,
    requirements: scoringJob.requirements,
  })
  // Base job-relevance score per evidence id, reused below so each question can be re-ranked against
  // its own wording without recomputing job relevance from scratch.
  const jobRelevanceById = new Map(ranked.map((r, i) => [r.evidence.id, ranked.length - i]))
  const usedEvidenceIds = new Set<string>()

  /** Per-question re-ranking (brief §14 step 5 "avoid repetitive answers"): blends job relevance with
   * how well the evidence's own text matches *this specific question*, and penalizes evidence already
   * used to answer an earlier question in the same application so four generic questions don't all
   * surface the identical top-ranked achievement. */
  function rankEvidenceForQuestion(question: string) {
    return [...evidence]
      .map((e) => {
        const textMatch = textSimilarity(question, `${e.title} ${e.description}`)
        const jobRelevance = jobRelevanceById.get(e.id) ?? 0
        const reusedPenalty = usedEvidenceIds.has(e.id) ? 1000 : 0
        return { evidence: e, score: jobRelevance + textMatch * 200 - reusedPenalty }
      })
      .sort((a, b) => b.score - a.score)
      .map((r) => r.evidence)
  }

  const results: AnsweredQuestion[] = []

  for (const { question, charLimit } of questions) {
    const classification = classifyQuestion(question)

    if (classification.isSensitive) {
      const predefined = classification.category ? await findPredefinedAnswer(classification.category, question) : null
      const answer: AnsweredQuestion = predefined
        ? {
            question,
            answer: truncateToLimit(predefined.answer, charLimit),
            isSensitive: true,
            requiresApproval: false,
            wasUserProvided: true,
            sourceEvidenceIds: [],
          }
        : {
            question,
            answer: null, // never auto-generated — brief §17
            isSensitive: true,
            requiresApproval: true,
            wasUserProvided: false,
            sourceEvidenceIds: [],
          }
      results.push(answer)
      continue
    }

    const relevantEvidence = rankEvidenceForQuestion(question).slice(0, 4)
    if (relevantEvidence[0]) usedEvidenceIds.add(relevantEvidence[0].id)
    const priorAnswers = await findSimilarPastAnswers(question, applicationId)
    const provider = await getAiProvider()

    let answerText: string
    let sourceEvidenceIds = relevantEvidence.map((e) => e.id)

    if (provider.id === "null") {
      answerText = relevantEvidence.length
        ? `${relevantEvidence[0].title}: ${relevantEvidence[0].description}`
        : "No directly relevant evidence on file for this question — please review and edit before submitting."
      sourceEvidenceIds = relevantEvidence.length ? [relevantEvidence[0].id] : []
    } else {
      try {
        const result = await provider.complete({
          system:
            "Answer this job application question truthfully and specifically, using ONLY the candidate evidence " +
            "provided. Never invent an employer, metric, date, or skill not present in the evidence. Avoid generic " +
            "filler phrasing. Vary your phrasing from any previous answers shown so responses don't read as " +
            "copy-pasted across applications." +
            (charLimit ? ` Keep the answer under ${charLimit} characters.` : ""),
          prompt:
            `Question: ${question}\n\nCompany: ${application.job.companyName}\nRole: ${application.job.title}\n\n` +
            `Relevant evidence:\n${relevantEvidence.map((e) => `- ${e.title}: ${e.description}`).join("\n")}` +
            (priorAnswers.length ? `\n\nPreviously used answers to similar questions (do not repeat verbatim):\n${priorAnswers.join("\n---\n")}` : ""),
          schema: AnswerSchema,
          temperature: 0.5,
        })
        const verification = verifyStatementAgainstEvidence(result.answer, evidenceCorpus(relevantEvidence))
        answerText = verification.passed
          ? result.answer
          : relevantEvidence.length
            ? `${relevantEvidence[0].title}: ${relevantEvidence[0].description}`
            : "UNKNOWN — no relevant evidence on file; please provide an answer manually."
      } catch {
        answerText = relevantEvidence.length
          ? `${relevantEvidence[0].title}: ${relevantEvidence[0].description}`
          : "UNKNOWN — no relevant evidence on file; please provide an answer manually."
      }
    }

    results.push({
      question,
      answer: truncateToLimit(answerText, charLimit),
      isSensitive: false,
      requiresApproval: false,
      wasUserProvided: false,
      sourceEvidenceIds,
    })
  }

  // Persist
  await prisma.applicationAnswer.deleteMany({ where: { applicationId } })
  for (const r of results) {
    const answerRow = await prisma.applicationAnswer.create({
      data: {
        applicationId,
        question: r.question,
        answer: r.answer,
        isSensitive: r.isSensitive,
        requiresApproval: r.requiresApproval,
        wasUserProvided: r.wasUserProvided,
      },
    })
    if (r.sourceEvidenceIds.length) {
      await prisma.applicationAnswerSource.createMany({
        data: r.sourceEvidenceIds.map((evidenceId) => ({ answerId: answerRow.id, evidenceId })),
      })
    }
  }

  await audit("application.questions_answered", "Application", applicationId, {
    count: results.length,
    sensitiveCount: results.filter((r) => r.isSensitive).length,
    needsHumanCount: results.filter((r) => r.requiresApproval).length,
    questionsJson: toJson(results.map((r) => r.question)),
  })

  return results
}
