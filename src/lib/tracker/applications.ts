import { prisma } from "@/lib/db/client"
import { audit } from "@/lib/audit/logger"
import { Prisma } from "@prisma/client"

/**
 * Duplicate-application prevention (brief §18) has two layers:
 *  1. Duplicate *postings* of the same role across sources are already
 *     merged into a single Job row at discovery time (src/lib/dedup).
 *  2. The `@@unique([jobId, profileId])` constraint on Application makes a
 *     second application to that same Job row impossible at the database
 *     level — this function is the friendly wrapper that turns the
 *     constraint violation into "return the existing application" instead
 *     of a raw DB error.
 */
export async function createOrGetApplication(jobId: string, profileId: string): Promise<{ application: Awaited<ReturnType<typeof prisma.application.findFirstOrThrow>>; alreadyExisted: boolean }> {
  try {
    const application = await prisma.application.create({ data: { jobId, profileId } })
    await prisma.applicationStatusEvent.create({
      data: { applicationId: application.id, toStatus: "DISCOVERED", actor: "system", reason: "Application record created." },
    })
    await audit("application.created", "Application", application.id, { jobId, profileId })
    return { application, alreadyExisted: false }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.application.findUniqueOrThrow({ where: { jobId_profileId: { jobId, profileId } } })
      await audit("application.duplicate_prevented", "Application", existing.id, { jobId, profileId })
      return { application: existing, alreadyExisted: true }
    }
    throw err
  }
}
