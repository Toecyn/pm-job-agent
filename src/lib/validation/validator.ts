import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { audit } from "@/lib/audit/logger"

export interface ValidationCheck {
  name: string
  passed: boolean
  message: string
}

export interface ValidationResult {
  passed: boolean
  checks: ValidationCheck[]
}

/**
 * Final pre-approval validation (brief §34) — the last mechanical gate
 * before an application can even be *shown* on the human approval screen,
 * let alone submitted. A failed check blocks the APPLICATION_PREPARED ->
 * AWAITING_APPROVAL transition (enforced by the state machine guard).
 */
export async function validateApplication(applicationId: string): Promise<ValidationResult> {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      job: true,
      profile: true,
      tailoredCv: { include: { bullets: true } },
      coverLetter: true,
      answers: true,
    },
  })

  const checks: ValidationCheck[] = []
  const check = (name: string, passed: boolean, message: string) => checks.push({ name, passed, message })

  check(
    "job_present",
    Boolean(application.job),
    application.job ? "Job record present and linked." : "No job linked to this application."
  )

  check(
    "mandatory_profile_fields",
    Boolean(application.profile.fullName && application.profile.email),
    application.profile.fullName && application.profile.email
      ? "Candidate name and email present."
      : "Candidate profile is missing full name or email."
  )

  check(
    "application_url_present",
    Boolean(application.job?.applicationUrl),
    application.job?.applicationUrl ? "Application URL present." : "Job has no application URL."
  )

  if (application.tailoredCv) {
    check(
      "cv_belongs_to_job",
      application.tailoredCv.jobId === application.jobId,
      application.tailoredCv.jobId === application.jobId
        ? "Tailored CV is linked to the correct job."
        : "Tailored CV is linked to a different job than this application — mismatch."
    )
    const failedBullets = application.tailoredCv.bullets.filter((b) => !b.verifierPassed)
    check(
      "no_fabricated_content",
      failedBullets.length === 0,
      failedBullets.length === 0
        ? "All CV bullet points passed evidence verification."
        : `${failedBullets.length} CV bullet(s) failed evidence verification and were replaced with the safe template — review before submitting.`
    )
  } else {
    check("cv_present", false, "No tailored CV has been generated for this application yet.")
  }

  if (application.coverLetterId && application.coverLetter) {
    check(
      "cover_letter_belongs_to_job",
      application.coverLetter.jobId === application.jobId,
      application.coverLetter.jobId === application.jobId
        ? "Cover letter is linked to the correct job."
        : "Cover letter is linked to a different job than this application — mismatch."
    )
  }

  const unresolvedSensitive = application.answers.filter((a) => a.isSensitive && a.requiresApproval && !a.answer)
  check(
    "sensitive_questions_resolved",
    unresolvedSensitive.length === 0,
    unresolvedSensitive.length === 0
      ? "No unresolved sensitive questions."
      : `${unresolvedSensitive.length} sensitive question(s) still need a human-provided answer: ${unresolvedSensitive.map((a) => `"${a.question}"`).join(", ")}.`
  )

  const missingAnswers = application.answers.filter((a) => !a.answer && !a.requiresApproval)
  check(
    "no_missing_mandatory_answers",
    missingAnswers.length === 0,
    missingAnswers.length === 0 ? "All non-sensitive questions have an answer." : `${missingAnswers.length} question(s) have no answer generated.`
  )

  // Duplicate-application guard (belt-and-braces on top of the DB unique constraint).
  const otherApplications = await prisma.application.count({
    where: { jobId: application.jobId, profileId: application.profileId, id: { not: application.id } },
  })
  check("no_duplicate_application", otherApplications === 0, otherApplications === 0 ? "No other application exists for this job." : "Another application already exists for this exact job.")

  const passed = checks.every((c) => c.passed)

  await prisma.application.update({
    where: { id: applicationId },
    data: { validationJson: toJson(checks), validationPassed: passed },
  })

  await audit("application.validated", "Application", applicationId, { passed, failedChecks: checks.filter((c) => !c.passed).map((c) => c.name) })

  return { passed, checks }
}
