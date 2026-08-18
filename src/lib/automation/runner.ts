import fs from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/db/client"
import { getSettings } from "@/lib/config/settings"
import { adapterRegistry } from "@/lib/sources/registry"
import { detectCaptcha, detectLoginWall, validateOnIntendedPage } from "./detectors"
import { loadRunState, saveRunState, type ApplicationRunState } from "./state"
import { fillGreenhouseApplication } from "./fillers/greenhouse"
import { fillLeverApplication } from "./fillers/lever"
import { fillAshbyApplication } from "./fillers/ashby"
import type { FillContext } from "./fillers/types"
import { markApplicationApplied } from "@/lib/tracker/approval"
import { notify } from "@/lib/notifications/service"
import { audit } from "@/lib/audit/logger"

const RUNS_DIR = path.join(process.cwd(), "screenshots", "agent-runs")

const FILLERS: Record<string, (ctx: FillContext) => Promise<{ filledFields: string[]; unfilledFields: string[] }>> = {
  greenhouse: fillGreenhouseApplication,
  lever: fillLeverApplication,
  ashby: fillAshbyApplication,
}

export interface AutomationRunResult {
  status: "submitted" | "awaiting_approval" | "paused" | "skipped" | "failed"
  reason: string
  screenshotPath?: string
}

async function autoRulesSatisfied(applicationId: string): Promise<{ ok: boolean; reason: string }> {
  const settings = await getSettings()
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: { include: { score: true, company: true } }, answers: true },
  })
  if (!application.job.score) return { ok: false, reason: "Job has not been scored." }
  if (application.job.score.fitScore < settings.autoApplyMinFit) return { ok: false, reason: `Fit score ${application.job.score.fitScore} below auto-apply threshold ${settings.autoApplyMinFit}.` }
  if (application.job.score.qualityScore < settings.autoApplyMinQuality) return { ok: false, reason: `Quality score ${application.job.score.qualityScore} below auto-apply threshold ${settings.autoApplyMinQuality}.` }
  if (application.job.company?.excluded) return { ok: false, reason: "Company is excluded." }
  const adapter = adapterRegistry[application.job.source]
  if (!adapter?.automatable) return { ok: false, reason: `Source "${application.job.source}" is not automatable.` }
  const unresolvedSensitive = application.answers.some((a) => a.isSensitive && a.requiresApproval && !a.answer)
  if (unresolvedSensitive) return { ok: false, reason: "Unresolved sensitive question(s) require human input." }
  if (!application.validationPassed) return { ok: false, reason: "Application has not passed validation." }
  return { ok: true, reason: "All AUTO-mode rules satisfied." }
}

/**
 * Runs (or resumes) browser-automated application filling for one
 * application, stopping at the human approval checkpoint unless the AUTO
 * mode rules are satisfied (brief §15-16). Requires AUTOMATION_ENABLED=true
 * and a Playwright browser install — see ARCHITECTURE.md §15 for why this
 * code is real but not exercised by this build's automated verification.
 */
export async function runApplicationAutomation(applicationId: string): Promise<AutomationRunResult> {
  if (process.env.AUTOMATION_ENABLED !== "true") {
    return { status: "skipped", reason: "AUTOMATION_ENABLED is not set to true — browser automation is disabled." }
  }

  const settings = await getSettings()
  if (settings.approvalMode === "MANUAL") {
    return { status: "skipped", reason: "Approval mode is MANUAL — the agent never automates submission. Use the application URL with the prepared materials." }
  }

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: true, profile: true, tailoredCv: true, coverLetter: true, answers: true },
  })

  if (application.status !== "AWAITING_APPROVAL") {
    return { status: "skipped", reason: `Application is in status ${application.status}, not AWAITING_APPROVAL.` }
  }

  const adapter = adapterRegistry[application.job.source]
  if (!adapter?.automatable) {
    return {
      status: "skipped",
      reason: `Source "${application.job.source}" is not automatable — open ${application.job.applicationUrl} and apply manually with the prepared CV/cover letter/answers.`,
    }
  }

  let canSubmit = application.approvalStatus === "approved"
  if (settings.approvalMode === "AUTO") {
    const rules = await autoRulesSatisfied(applicationId)
    canSubmit = rules.ok
    if (!rules.ok) {
      await audit("automation.auto_apply_blocked", "Application", applicationId, { reason: rules.reason })
    }
  }

  await fs.mkdir(RUNS_DIR, { recursive: true })
  const state = await loadRunState(applicationId)

  // Lazy import so `playwright` (and its browser binaries) are only ever
  // touched when automation is actually enabled and invoked.
  const { chromium } = await import("playwright")
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== "false" })

  try {
    const page = await browser.newPage()
    await page.goto(application.job.applicationUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
    state.step = "navigated"
    await saveRunState(applicationId, state)

    const pageCheck = await validateOnIntendedPage(page, application.job.companyName, application.job.title)
    if (!pageCheck.ok) {
      return await pauseRun(applicationId, state, "paused_layout_changed", pageCheck.reason, page)
    }
    state.step = "validated_page"
    await saveRunState(applicationId, state)

    if (await detectLoginWall(page, new URL(application.job.applicationUrl).host)) {
      return await pauseRun(applicationId, state, "paused_login_required", "Application page requires authentication — cannot proceed without credentials.", page)
    }
    if (await detectCaptcha(page)) {
      return await pauseRun(applicationId, state, "paused_captcha", "CAPTCHA detected — pausing for human intervention (brief §33/§49: never bypassed).", page)
    }

    if (!application.tailoredCv) {
      return await pauseRun(applicationId, state, "failed", "No tailored CV found for this application.", page)
    }
    const cvFilePath = path.join(RUNS_DIR, `${applicationId}-cv.txt`)
    await fs.writeFile(cvFilePath, application.tailoredCv.renderedText, "utf8")
    state.step = "cv_selected"
    await saveRunState(applicationId, state)

    const [firstName, ...rest] = application.profile.fullName.split(" ")
    const fillCtx: FillContext = {
      page,
      fullName: application.profile.fullName,
      firstName,
      lastName: rest.join(" ") || firstName,
      email: application.profile.email,
      phone: application.profile.phone ?? undefined,
      linkedinUrl: application.profile.linkedinUrl ?? undefined,
      portfolioUrl: application.profile.portfolioUrl ?? undefined,
      location: application.profile.location ?? undefined,
      cvFilePath,
      coverLetterText: application.coverLetter?.content,
      answers: application.answers.filter((a) => a.answer).map((a) => ({ question: a.question, answer: a.answer! })),
    }

    const outcome = await FILLERS[application.job.source](fillCtx)
    state.step = "fields_filled"
    state.filledFields = outcome.filledFields
    state.notes = outcome.unfilledFields.length ? [`Could not auto-fill: ${outcome.unfilledFields.join(", ")}`] : []
    await saveRunState(applicationId, state)

    const screenshotPath = path.join(RUNS_DIR, `${applicationId}-review.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
    state.step = "reviewed"
    state.screenshotPath = screenshotPath
    await saveRunState(applicationId, state)

    if (!canSubmit) {
      state.step = "awaiting_human_approval"
      await saveRunState(applicationId, state)
      await notify({
        type: "application_ready_for_approval",
        severity: "info",
        title: `Application filled, awaiting approval: ${application.job.title} at ${application.job.companyName}`,
        message: "Browser automation filled the form and stopped at the human approval checkpoint.",
        meta: { applicationId },
      })
      return { status: "awaiting_approval", reason: "Form filled; stopped at the approval checkpoint.", screenshotPath }
    }

    const submitButton = page.getByRole("button", { name: /submit application|submit|apply now/i }).first()
    await submitButton.click({ timeout: 10_000 })
    state.step = "submitted"
    await saveRunState(applicationId, state)
    await markApplicationApplied(applicationId, "automated")
    await notify({
      type: "application_submitted",
      severity: "success",
      title: `Application submitted: ${application.job.title} at ${application.job.companyName}`,
      message: "Submitted automatically per your AUTO-mode rules." ,
      meta: { applicationId },
    })

    return { status: "submitted", reason: "Application submitted.", screenshotPath }
  } catch (err) {
    const message = (err as Error).message
    state.step = "failed"
    state.errorMessage = message
    await saveRunState(applicationId, state)
    await notify({
      type: "agent_failure",
      severity: "error",
      title: `Automation failed: ${application.job.title} at ${application.job.companyName}`,
      message,
      meta: { applicationId },
    })
    await audit("automation.failed", "Application", applicationId, { error: message })
    return { status: "failed", reason: message }
  } finally {
    await browser.close().catch(() => undefined)
  }
}

async function pauseRun(
  applicationId: string,
  state: ApplicationRunState,
  step: ApplicationRunState["step"],
  reason: string,
  page: import("playwright").Page
): Promise<AutomationRunResult> {
  const screenshotPath = path.join(RUNS_DIR, `${applicationId}-pause.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
  state.step = step
  state.errorMessage = reason
  state.screenshotPath = screenshotPath
  await saveRunState(applicationId, state)
  await notify({
    type: step === "paused_captcha" ? "captcha_encountered" : step === "paused_login_required" ? "authentication_required" : "human_intervention_required",
    severity: "warning",
    title: "Application automation paused",
    message: reason,
    meta: { applicationId },
  })
  await audit("automation.paused", "Application", applicationId, { step, reason })
  return { status: "paused", reason, screenshotPath }
}
