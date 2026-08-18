import { prisma } from "@/lib/db/client"
import { audit } from "@/lib/audit/logger"
import type { Application } from "@prisma/client"
import type { ApplicationStatus } from "@/lib/types/enums"

/**
 * Application pipeline state machine (brief §19). An explicit transition
 * table + per-edge guard, rather than allowing any status to be set from
 * anywhere — illegal transitions throw and are logged, never silently
 * coerced (ARCHITECTURE.md §10).
 */
type Guard = (app: Application) => { ok: true } | { ok: false; reason: string }

const TERMINAL_STATES: ApplicationStatus[] = ["REJECTED", "WITHDRAWN", "GHOSTED"]

const FORWARD_PATH: ApplicationStatus[] = [
  "DISCOVERED",
  "ANALYZED",
  "SCORED",
  "SHORTLISTED",
  "CV_TAILORED",
  "APPLICATION_PREPARED",
  "AWAITING_APPROVAL",
  "APPLIED",
  "ASSESSMENT",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
]

const GUARDS: Partial<Record<string, Guard>> = {
  "APPLICATION_PREPARED->AWAITING_APPROVAL": (app) =>
    app.validationPassed ? { ok: true } : { ok: false, reason: "Application has not passed validation yet." },
  "AWAITING_APPROVAL->APPLIED": (app) =>
    app.approvalStatus === "approved"
      ? { ok: true }
      : { ok: false, reason: `Cannot mark as applied without an "approved" approval decision (current: ${app.approvalStatus ?? "none"}).` },
}

function buildAllowedTransitions(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (let i = 0; i < FORWARD_PATH.length - 1; i++) {
    const from = FORWARD_PATH[i]
    const to = FORWARD_PATH[i + 1]
    map.set(from, new Set([to]))
  }
  // Any non-terminal state can end in rejection/withdrawal/ghosting.
  for (const state of FORWARD_PATH) {
    const set = map.get(state) ?? new Set<string>()
    set.add("REJECTED")
    set.add("WITHDRAWN")
    set.add("GHOSTED")
    map.set(state, set)
  }
  // OFFER can additionally resolve to withdrawn (candidate declines) or rejected (offer pulled).
  map.set("OFFER", new Set(["WITHDRAWN", "REJECTED"]))
  return map
}

const ALLOWED = buildAllowedTransitions()

export class IllegalTransitionError extends Error {}

export async function transitionApplication(
  applicationId: string,
  toStatus: ApplicationStatus,
  opts: { reason?: string; actor?: "system" | "user" } = {}
): Promise<Application> {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })
  const fromStatus = app.status as ApplicationStatus

  if (TERMINAL_STATES.includes(fromStatus)) {
    const err = new IllegalTransitionError(`Application ${applicationId} is in terminal state ${fromStatus}; cannot transition to ${toStatus}.`)
    await audit("application.transition_rejected", "Application", applicationId, { fromStatus, toStatus, reason: err.message })
    throw err
  }

  const allowedTargets = ALLOWED.get(fromStatus)
  if (!allowedTargets?.has(toStatus)) {
    const err = new IllegalTransitionError(`Illegal transition ${fromStatus} -> ${toStatus} for application ${applicationId}.`)
    await audit("application.transition_rejected", "Application", applicationId, { fromStatus, toStatus, reason: err.message })
    throw err
  }

  const guard = GUARDS[`${fromStatus}->${toStatus}`]
  if (guard) {
    const result = guard(app)
    if (!result.ok) {
      const err = new IllegalTransitionError(result.reason)
      await audit("application.transition_rejected", "Application", applicationId, { fromStatus, toStatus, reason: result.reason })
      throw err
    }
  }

  const updated = await prisma.application.update({ where: { id: applicationId }, data: { status: toStatus } })
  await prisma.applicationStatusEvent.create({
    data: { applicationId, fromStatus, toStatus, reason: opts.reason, actor: opts.actor ?? "system" },
  })
  await audit("application.transitioned", "Application", applicationId, { fromStatus, toStatus, reason: opts.reason }, opts.actor ?? "system")

  return updated
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATES.includes(status as ApplicationStatus)
}
