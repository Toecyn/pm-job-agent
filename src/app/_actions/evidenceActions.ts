"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { audit } from "@/lib/audit/logger"

export interface AddEvidenceState {
  error?: string
  success?: boolean
}

export async function addEvidenceAction(_prev: AddEvidenceState, formData: FormData): Promise<AddEvidenceState> {
  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const evidenceType = String(formData.get("evidenceType") ?? "achievement")
  const company = String(formData.get("company") ?? "").trim() || null
  const roleTitle = String(formData.get("roleTitle") ?? "").trim() || null
  const startDate = String(formData.get("startDate") ?? "").trim()
  const endDate = String(formData.get("endDate") ?? "").trim()
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)

  if (!title || !description) return { error: "Title and description are required." }

  const profile = await prisma.candidateProfile.findFirstOrThrow()
  await prisma.careerEvidence.create({
    data: {
      profileId: profile.id,
      company,
      roleTitle,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      evidenceType,
      title,
      description,
      tagsJson: toJson(tags),
      metricsJson: toJson([]),
    },
  })
  await audit("evidence.added", "CareerEvidence", null, { title }, "user")
  revalidatePath("/career-evidence")
  return { success: true }
}

export async function deleteEvidenceAction(evidenceId: string) {
  // Evidence already cited by a generated CV bullet or application answer is kept — deleting it would break
  // that document's evidence traceability (brief §36). Mark it unverified instead so it's excluded from future
  // generation while the existing citations remain inspectable.
  const [bulletRefs, answerRefs] = await Promise.all([
    prisma.cvBulletSource.count({ where: { primaryEvidenceId: evidenceId } }),
    prisma.applicationAnswerSource.count({ where: { evidenceId } }),
  ])
  if (bulletRefs > 0 || answerRefs > 0) {
    await prisma.careerEvidence.update({ where: { id: evidenceId }, data: { isVerified: false } })
  } else {
    await prisma.careerEvidence.delete({ where: { id: evidenceId } })
  }
  revalidatePath("/career-evidence")
}
