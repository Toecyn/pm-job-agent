import { prisma } from "@/lib/db/client"
import { fromJson, toJson } from "@/lib/utils/json"

/**
 * Resumable automation state (brief §33): persisted after every step so a
 * crash mid-application resumes from the last completed step instead of
 * blindly restarting (which risks a duplicate submission). Also the record
 * of exactly where a run paused for CAPTCHA/login/human intervention.
 */
export type AutomationStepName =
  | "not_started"
  | "navigated"
  | "validated_page"
  | "cv_selected"
  | "cv_uploaded"
  | "fields_filled"
  | "questions_filled"
  | "reviewed"
  | "awaiting_human_approval"
  | "submitted"
  | "paused_captcha"
  | "paused_login_required"
  | "paused_layout_changed"
  | "failed"

export interface ApplicationRunState {
  step: AutomationStepName
  updatedAt: string
  filledFields: string[]
  screenshotPath?: string
  errorMessage?: string
  notes?: string[]
}

export async function loadRunState(applicationId: string): Promise<ApplicationRunState> {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })
  return fromJson<ApplicationRunState>(app.automationStateJson, {
    step: "not_started",
    updatedAt: new Date().toISOString(),
    filledFields: [],
  })
}

export async function saveRunState(applicationId: string, state: ApplicationRunState): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data: { automationStateJson: toJson({ ...state, updatedAt: new Date().toISOString() }) },
  })
}
