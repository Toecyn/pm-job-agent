import { z } from "zod"
import { prisma } from "@/lib/db/client"
import { toJson, fromJsonArray } from "@/lib/utils/json"
import { getAiProvider } from "@/lib/ai/provider"
import { rankEvidenceForJob } from "@/lib/cv/evidenceRanking"
import { buildScoringJob } from "@/lib/scoring/scoreJob"
import { audit } from "@/lib/audit/logger"

export interface StarStory {
  situation: string
  task: string
  action: string
  result: string
  sourceEvidenceId: string
}

export interface InterviewQuestion {
  category: "product_case" | "behavioral" | "leadership" | "technical" | "ai_data" | "from_cv" | "from_jd"
  question: string
}

export interface InterviewPrepContent {
  companyOverview: string
  productAnalysis: string
  roleAnalysis: string
  likelyQuestions: InterviewQuestion[]
  starStories: StarStory[]
  questionsToAsk: string[]
  weaknesses: { concern: string; mitigation: string }[]
}

const QUESTIONS_TO_ASK_BANK = [
  "How does the team decide what to prioritize when discovery and delivery pressures conflict?",
  "What does success look like for this role in the first 6 months?",
  "How is product success measured here — what are the top 2-3 metrics this team owns?",
  "What's the biggest product challenge the team is wrestling with right now?",
  "How does the product org work with engineering and design day to day?",
]

function starFromEvidence(evidence: { id: string; company: string | null; roleTitle: string | null; title: string; description: string; metricsJson: string }): StarStory {
  const metrics = fromJsonArray<{ label: string; value: string; unit?: string }>(evidence.metricsJson)
  return {
    situation: `At ${evidence.company ?? "a previous role"}${evidence.roleTitle ? ` as ${evidence.roleTitle}` : ""}.`,
    task: evidence.title,
    action: evidence.description,
    result: metrics.length ? metrics.map((m) => `${m.label}: ${m.value}${m.unit ?? ""}`).join("; ") : "Impact documented qualitatively in the evidence record.",
    sourceEvidenceId: evidence.id,
  }
}

function templateQuestions(jobTitle: string, companyName: string, requirements: { techRequirements: string[]; leadershipRequirements?: string }): InterviewQuestion[] {
  const qs: InterviewQuestion[] = [
    { category: "product_case", question: `How would you approach improving [core product metric] for ${companyName}'s product in the first 90 days?` },
    { category: "product_case", question: "Walk me through how you'd prioritize a roadmap with conflicting stakeholder demands." },
    { category: "behavioral", question: "Tell me about a time a launch didn't go as planned. What did you do?" },
    { category: "behavioral", question: "Describe a time you had to say no to a senior stakeholder." },
    { category: "from_jd", question: `This role emphasizes ${requirements.techRequirements.slice(0, 2).join(" and ") || "cross-functional delivery"} — how have you approached that in the past?` },
  ]
  if (requirements.leadershipRequirements) {
    qs.push({ category: "leadership", question: "How do you approach mentoring or managing product managers on your team?" })
  }
  qs.push({ category: "ai_data", question: "How do you decide when a feature genuinely benefits from AI/ML vs. simpler heuristics?" })
  qs.push({ category: "from_cv", question: `Tell me more about your experience relevant to ${jobTitle}.` })
  return qs
}

export async function generateInterviewPrep(applicationId: string) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: { include: { company: true, score: true } } },
  })
  const evidence = await prisma.careerEvidence.findMany({ where: { profileId: application.profileId, isVerified: true } })
  const scoringJob = buildScoringJob(application.job, application.job.company)
  const ranked = rankEvidenceForJob(evidence, { titleFamily: application.job.titleFamily, title: application.job.title, requirements: scoringJob.requirements })
  const topEvidence = ranked.slice(0, 5).map((r) => r.evidence)

  const companyIntel = application.job.company?.intelJson ? JSON.parse(application.job.company.intelJson) : null
  const concerns = application.job.score ? fromJsonArray<string>(application.job.score.concernsJson) : []

  const starStories = topEvidence.map(starFromEvidence)
  const likelyQuestions = templateQuestions(application.job.title, application.job.companyName, scoringJob.requirements)
  const weaknesses = concerns.map((c) => ({
    concern: c,
    mitigation: "Prepare a concise, honest response acknowledging the gap and pointing at the closest adjacent evidence you do have.",
  }))

  const content: InterviewPrepContent = {
    companyOverview: companyIntel?.productOverview ?? "UNKNOWN — run Company Intelligence from the Companies page for a fuller picture.",
    productAnalysis: companyIntel?.productStrategyNotes ?? "UNKNOWN — no company intelligence gathered yet.",
    roleAnalysis: `${application.job.title} at ${application.job.companyName}. Seniority: ${application.job.seniority}. Key responsibilities: ${fromJsonArray<string>(application.job.responsibilitiesJson).slice(0, 4).join("; ") || "see job description"}.`,
    likelyQuestions,
    starStories,
    questionsToAsk: QUESTIONS_TO_ASK_BANK,
    weaknesses,
  }

  // Optionally sharpen phrasing with the AI provider — still grounded entirely in the deterministic content above.
  const provider = await getAiProvider()
  if (provider.id !== "null") {
    try {
      const sharpened = await provider.complete({
        system:
          "Given this interview prep outline, suggest 2 additional, specific likely interview questions (product case " +
          "and technical/AI categories) tailored to the role and company context provided. Do not invent facts about " +
          "the company beyond what's given.",
        prompt: `Role: ${application.job.title} at ${application.job.companyName}\nRole analysis: ${content.roleAnalysis}\nCompany overview: ${content.companyOverview}`,
        schema: z.object({ questions: z.array(z.object({ category: z.enum(["product_case", "technical", "ai_data"]), question: z.string() })).max(3) }),
        temperature: 0.5,
      })
      content.likelyQuestions.push(...sharpened.questions.map((q) => ({ category: q.category as InterviewQuestion["category"], question: q.question })))
    } catch {
      // keep the deterministic set
    }
  }

  const pkg = await prisma.interviewPrepPackage.create({ data: { applicationId, contentJson: toJson(content) } })
  await audit("interviewprep.generated", "Application", applicationId, { packageId: pkg.id })
  return { packageId: pkg.id, content }
}
