import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"

/**
 * Append-only audit trail (brief §32, §41). Every discovery, score, CV
 * generation, application change, submission, error, and human approval
 * gets a row. Never write PII secrets (raw work-auth / comp values) into
 * `details` — reference the entity id instead and let the UI re-fetch the
 * decrypted value under auth.
 */
export type AuditActor = "system" | "user"

export async function audit(
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
  actor: AuditActor = "system"
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        entityType,
        entityId: entityId ?? undefined,
        detailsJson: details ? toJson(details) : undefined,
      },
    })
  } catch (err) {
    // Audit logging must never take down the calling operation. Fall back to
    // stderr so failures are still observable.
    console.error("[audit] failed to write audit log", action, entityType, entityId, err)
  }
}
