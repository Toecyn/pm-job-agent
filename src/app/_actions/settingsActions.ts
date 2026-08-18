"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/client"
import { updateSettings } from "@/lib/config/settings"
import { audit } from "@/lib/audit/logger"

function splitList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function updateGeneralSettingsAction(formData: FormData) {
  await updateSettings({
    jobTitles: splitList(formData.get("jobTitles")),
    targetSeniorities: splitList(formData.get("targetSeniorities")),
    locations: splitList(formData.get("locations")),
    countries: splitList(formData.get("countries")),
    industries: splitList(formData.get("industries")),
    remotePreference: String(formData.get("remotePreference") ?? "any"),
    minFitScore: Number(formData.get("minFitScore") ?? 60),
    minQualityScore: Number(formData.get("minQualityScore") ?? 0),
    initialWindowDays: Number(formData.get("initialWindowDays") ?? 7),
    overlapMinutes: Number(formData.get("overlapMinutes") ?? 45),
    followUpDelayDays: Number(formData.get("followUpDelayDays") ?? 7),
    coverLetterPreference: String(formData.get("coverLetterPreference") ?? "if_required") as never,
  })
  revalidatePath("/settings")
}

export async function updateApprovalSettingsAction(formData: FormData) {
  await updateSettings({
    approvalMode: String(formData.get("approvalMode") ?? "REVIEW") as never,
    autoApplyMinFit: Number(formData.get("autoApplyMinFit") ?? 90),
    autoApplyMinQuality: Number(formData.get("autoApplyMinQuality") ?? 80),
  })
  revalidatePath("/settings")
}

export async function updateAiSettingsAction(formData: FormData) {
  await updateSettings({
    aiProvider: String(formData.get("aiProvider") ?? "null") as never,
    aiModel: String(formData.get("aiModel") ?? ""),
  })
  revalidatePath("/settings")
}

export async function updateNotificationSettingsAction(formData: FormData) {
  const channels = formData.getAll("channels").map(String)
  await updateSettings({ notificationPrefs: { channels } })
  revalidatePath("/settings")
}

export async function addWatchedBoardAction(formData: FormData) {
  const source = String(formData.get("source") ?? "")
  const token = String(formData.get("token") ?? "").trim()
  const label = String(formData.get("label") ?? "").trim() || token
  if (!token) return
  await prisma.watchedBoard.upsert({
    where: { source_token: { source, token } },
    update: { label, enabled: true },
    create: { source, token, label, enabled: true },
  })
  revalidatePath("/settings")
}

export async function toggleWatchedBoardAction(id: string) {
  const board = await prisma.watchedBoard.findUniqueOrThrow({ where: { id } })
  await prisma.watchedBoard.update({ where: { id }, data: { enabled: !board.enabled } })
  revalidatePath("/settings")
}

export async function deleteWatchedBoardAction(id: string) {
  await prisma.watchedBoard.delete({ where: { id } })
  revalidatePath("/settings")
}

export async function savePredefinedAnswerAction(formData: FormData) {
  const category = String(formData.get("category") ?? "")
  const question = String(formData.get("question") ?? "").trim()
  const answer = String(formData.get("answer") ?? "").trim()
  if (!question || !answer) return
  await prisma.predefinedAnswer.create({ data: { category, question, answer } })
  await audit("settings.predefined_answer_added", "PredefinedAnswer", null, { category }, "user")
  revalidatePath("/settings")
}

export async function deletePredefinedAnswerAction(id: string) {
  await prisma.predefinedAnswer.delete({ where: { id } })
  revalidatePath("/settings")
}
