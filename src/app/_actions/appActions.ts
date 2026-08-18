"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { runSearch } from "@/lib/search/runSearch"
import { clearSessionCookie } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"

export async function runSearchNowAction() {
  const result = await runSearch()
  revalidatePath("/dashboard")
  revalidatePath("/jobs")
  revalidatePath("/agent-logs")
  return result
}

export async function logoutAction() {
  await clearSessionCookie()
  redirect("/login")
}

export async function markAllNotificationsReadAction() {
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } })
  revalidatePath("/dashboard")
}
