import { prisma } from "@/lib/db/client"
import { createOrGetApplication } from "@/lib/tracker/applications"
import { transitionApplication } from "@/lib/tracker/stateMachine"
import { tailorCvForJob } from "@/lib/cv/tailor"
import { generateCoverLetter } from "@/lib/coverletter/generate"
import { answerApplicationQuestions } from "@/lib/questions/engine"
import { validateApplication } from "@/lib/validation/validator"
import { getSettings } from "@/lib/config/settings"
import { notify } from "@/lib/notifications/service"
import { audit } from "@/lib/audit/logger"

/**
 * The full Discover -> Analyze -> Score -> Tailor -> Prepare pipeline
 * (brief §15) for a single job the user has shortlisted, ending at
 * AWAITING_APPROVAL. Submission is a deliberately separate step (see
 * src/lib/automation) so preparing materials never has a side effect on a
 * real job application.
 */
export interface PrepareApplicationOptions {
  jobId: string
  profileId?: string
  questions?: { question: string; charLimit?: number }[]
  variantKeyOverride?: string
}

export async function prepareApplication(opts: PrepareApplicationOptions) {
  const profile = opts.profileId
    ? await prisma.candidateProfile.findUniqueOrThrow({ where: { id: opts.profileId } })
    : await prisma.candidateProfile.findFirstOrThrow()

  const { application, alreadyExisted } = await createOrGetApplication(opts.jobId, profile.id)
  if (alreadyExisted && !["DISCOVERED", "ANALYZED", "SCORED", "SHORTLISTED"].includes(application.status)) {
    // Already further along the pipeline (or terminal) — don't restart/duplicate work.
    return { application, skipped: true, reason: `Application already exists in status ${application.status}.` }
  }

  const job = await prisma.job.findUniqueOrThrow({ where: { id: opts.jobId } })
  const existingScore = await prisma.jobScore.findUnique({ where: { jobId: job.id } })
  if (!existingScore) {
    // scoreJobById is idempotent; ensure a score exists (defensive — normally already scored at discovery).
    const { scoreJobById } = await import("@/lib/scoring/scoreJob")
    await scoreJobById(job.id, profile.id)
  }

  await safeTransition(application.id, "ANALYZED")
  await safeTransition(application.id, "SCORED")
  await safeTransition(application.id, "SHORTLISTED")

  const { tailoredCv } = await tailorCvForJob({ jobId: opts.jobId, profileId: profile.id, variantKeyOverride: opts.variantKeyOverride })
  await prisma.application.update({ where: { id: application.id }, data: { tailoredCvId: tailoredCv.id } })
  await safeTransition(application.id, "CV_TAILORED")

  const coverLetterResult = await generateCoverLetter(opts.jobId, profile.id)
  if (coverLetterResult.coverLetterId) {
    await prisma.application.update({ where: { id: application.id }, data: { coverLetterId: coverLetterResult.coverLetterId } })
  }

  const defaultQuestions = opts.questions ?? defaultApplicationQuestions()
  await answerApplicationQuestions(application.id, defaultQuestions)

  const settings = await getSettings()
  await prisma.application.update({ where: { id: application.id }, data: { approvalMode: settings.approvalMode } })

  await safeTransition(application.id, "APPLICATION_PREPARED")

  const validation = await validateApplication(application.id)
  if (validation.passed) {
    await safeTransition(application.id, "AWAITING_APPROVAL")
    await notify({
      type: "application_ready_for_approval",
      severity: "info",
      title: `Ready for review: ${job.title} at ${job.companyName}`,
      message: "CV, cover letter, and application answers are prepared and awaiting your approval.",
      meta: { applicationId: application.id, jobId: job.id },
    })
  }

  await audit("application.prepared", "Application", application.id, { jobId: opts.jobId, validationPassed: validation.passed })

  return { application: await prisma.application.findUniqueOrThrow({ where: { id: application.id } }), validation, skipped: false }
}

async function safeTransition(applicationId: string, to: Parameters<typeof transitionApplication>[1]) {
  try {
    await transitionApplication(applicationId, to)
  } catch {
    // Already at or past this state (e.g. re-running prepare on a partially-progressed application) — non-fatal.
  }
}

function defaultApplicationQuestions(): { question: string; charLimit?: number }[] {
  return [
    { question: "Why do you want to work here?", charLimit: 600 },
    { question: "Why are you a good fit for this role?", charLimit: 600 },
    { question: "Tell us about a product you launched.", charLimit: 800 },
    { question: "Describe your experience with AI.", charLimit: 600 },
    { question: "What is your salary expectation?" },
    { question: "Are you legally authorized to work in the country where this job is located?" },
  ]
}
