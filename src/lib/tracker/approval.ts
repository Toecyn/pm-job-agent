import { prisma } from "@/lib/db/client"
import { audit } from "@/lib/audit/logger"
import { transitionApplication } from "./stateMachine"
import type { ApprovalDecisionKind } from "@/lib/types/enums"
import { scheduleApplicationFollowUp } from "@/lib/followup/engine"

/**
 * Human approval actions (brief §16): Approve / Reject / Edit / Skip /
 * Blacklist company / Blacklist role. Every decision is recorded as an
 * immutable ApprovalDecision row (audit trail) in addition to updating the
 * application's current approvalStatus.
 */
export async function recordApprovalDecision(
  applicationId: string,
  decision: ApprovalDecisionKind,
  notes?: string
): Promise<void> {
  const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })

  await prisma.approvalDecision.create({ data: { applicationId, decision, notes } })

  switch (decision) {
    case "approve":
      await prisma.application.update({ where: { id: applicationId }, data: { approvalStatus: "approved" } })
      break
    case "edit":
      await prisma.application.update({ where: { id: applicationId }, data: { approvalStatus: "edited" } })
      break
    case "skip":
      await prisma.application.update({ where: { id: applicationId }, data: { approvalStatus: "skipped" } })
      break
    case "reject":
      await prisma.application.update({ where: { id: applicationId }, data: { approvalStatus: "rejected" } })
      await transitionApplication(applicationId, "WITHDRAWN", { reason: notes ?? "Rejected at approval stage.", actor: "user" })
      break
    case "blacklist_company": {
      const job = await prisma.job.findUnique({ where: { id: application.jobId } })
      if (job?.companyId) {
        await prisma.company.update({ where: { id: job.companyId }, data: { excluded: true } })
      }
      await prisma.application.update({ where: { id: applicationId }, data: { approvalStatus: "rejected" } })
      await transitionApplication(applicationId, "WITHDRAWN", { reason: "Company blacklisted.", actor: "user" })
      break
    }
    case "blacklist_role": {
      // Recorded for transparency/audit; enforcing this prospectively means
      // excluding the job's title family in Settings > Job Titles, which the
      // Settings page surfaces as a one-click suggestion from this decision.
      await prisma.application.update({ where: { id: applicationId }, data: { approvalStatus: "rejected" } })
      await transitionApplication(applicationId, "WITHDRAWN", { reason: "Role family blacklisted.", actor: "user" })
      break
    }
  }

  await audit("application.approval_decision", "Application", applicationId, { decision, notes }, "user")
}

/** Human confirms an application was actually submitted (manual apply, or post-automation confirmation). */
export async function markApplicationApplied(applicationId: string, appliedVia: "automated" | "manual"): Promise<void> {
  await transitionApplication(applicationId, "APPLIED", { reason: `Marked applied (${appliedVia}).`, actor: "user" })
  await prisma.application.update({ where: { id: applicationId }, data: { submittedAt: new Date(), appliedVia } })
  await audit("application.submitted", "Application", applicationId, { appliedVia })
  await scheduleApplicationFollowUp(applicationId)
}
