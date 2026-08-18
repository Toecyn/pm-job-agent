"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/client"
import { audit } from "@/lib/audit/logger"

export async function toggleCompanyFlagAction(companyId: string, field: "excluded" | "prioritized") {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  await prisma.company.update({ where: { id: companyId }, data: { [field]: !company[field] } })
  await audit(`company.${field}_toggled`, "Company", companyId, { newValue: !company[field] }, "user")
  revalidatePath("/companies")
  revalidatePath(`/companies/${companyId}`)
}

export async function updateCompanyWebsiteAction(companyId: string, website: string) {
  await prisma.company.update({ where: { id: companyId }, data: { website } })
  revalidatePath(`/companies/${companyId}`)
}
