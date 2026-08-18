"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/client"
import { recordApprovalDecision, markApplicationApplied } from "@/lib/tracker/approval"
import { runApplicationAutomation } from "@/lib/automation/runner"
import { generateInterviewPrep } from "@/lib/interviewPrep/generate"
import type { ApprovalDecisionKind } from "@/lib/types/enums"

export async function approvalDecisionAction(applicationId: string, decision: ApprovalDecisionKind, notes?: string) {
  await recordApprovalDecision(applicationId, decision, notes)
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/applications")
}

export async function markAppliedManuallyAction(applicationId: string) {
  await markApplicationApplied(applicationId, "manual")
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/applications")
}

export async function runAutomationAction(applicationId: string) {
  const result = await runApplicationAutomation(applicationId)
  revalidatePath(`/applications/${applicationId}`)
  return result
}

export async function generateInterviewPrepAction(applicationId: string) {
  await generateInterviewPrep(applicationId)
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/interview-prep")
}

export async function updateAnswerAction(answerId: string, answer: string) {
  await prisma.applicationAnswer.update({ where: { id: answerId }, data: { answer, requiresApproval: false } })
}

export async function setApplicationStatusManuallyAction(applicationId: string, status: string) {
  const { transitionApplication } = await import("@/lib/tracker/stateMachine")
  await transitionApplication(applicationId, status as never, { actor: "user", reason: "Manually updated from dashboard." })
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/applications")
}
