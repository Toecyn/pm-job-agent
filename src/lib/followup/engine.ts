import { prisma } from "@/lib/db/client"
import { getSettings } from "@/lib/config/settings"
import { notify } from "@/lib/notifications/service"
import { audit } from "@/lib/audit/logger"

/**
 * Follow-Up Engine (brief §20). Only ever *suggests* a follow-up message
 * and reminds the user — it never contacts a recruiter on its own behalf
 * ("Do not automatically contact recruiters without explicit permission").
 */
export async function scheduleApplicationFollowUp(applicationId: string): Promise<void> {
  const settings = await getSettings()
  const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId }, include: { job: true } })

  const dueAt = new Date(Date.now() + settings.followUpDelayDays * 24 * 3600_000)
  const suggestedMessage =
    `Hi [Recruiter/Hiring Manager name], I applied for the ${application.job.title} role at ${application.job.companyName} ` +
    `on ${application.submittedAt?.toDateString() ?? "the application date"} and wanted to check in on the status. ` +
    `I'm very interested in the opportunity and happy to share any more information that would help. Thanks for your time!`

  await prisma.followUp.create({
    data: { applicationId, kind: "recruiter_followup", dueAt, suggestedMessage },
  })
  await audit("followup.scheduled", "Application", applicationId, { dueAt })
}

/** Run periodically (or on dashboard load) to surface due follow-ups as notifications — never auto-sent. */
export async function checkDueFollowUps(): Promise<number> {
  const due = await prisma.followUp.findMany({
    where: { status: "pending", dueAt: { lte: new Date() } },
    include: { application: { include: { job: true } } },
  })
  for (const followUp of due) {
    await notify({
      type: "follow_up_reminder",
      severity: "info",
      title: `Follow-up suggested: ${followUp.application.job.title} at ${followUp.application.job.companyName}`,
      message: "It's been a while since you applied — consider a recruiter follow-up (draft ready for your review).",
      meta: { applicationId: followUp.applicationId, followUpId: followUp.id },
    })
  }
  return due.length
}
