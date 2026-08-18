"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { scoreJobById } from "@/lib/scoring/scoreJob"
import { prepareApplication } from "@/lib/pipeline/prepareApplication"
import { gatherCompanyIntelligence } from "@/lib/companyIntel/gather"
import { importJobFromUrl } from "@/lib/sources/manualImport"
import { normalizeRawPosting } from "@/lib/normalize/normalizer"
import { getSettings } from "@/lib/config/settings"
import { toJson } from "@/lib/utils/json"

export async function scoreJobAction(jobId: string) {
  await scoreJobById(jobId)
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath("/jobs")
}

export async function prepareApplicationAction(jobId: string) {
  const result = await prepareApplication({ jobId })
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath("/applications")
  redirect(`/applications/${result.application.id}`)
}

export async function gatherCompanyIntelAction(companyId: string) {
  await gatherCompanyIntelligence(companyId)
  revalidatePath(`/companies/${companyId}`)
}

export interface ImportJobState {
  error?: string
  success?: boolean
}

export async function importJobFromUrlAction(_prev: ImportJobState, formData: FormData): Promise<ImportJobState> {
  const url = String(formData.get("url") ?? "").trim()
  if (!url) return { error: "Enter a job URL." }

  const { posting, error } = await importJobFromUrl(url)
  if (error || !posting) return { error: error ?? "Could not import that URL." }

  const settings = await getSettings()
  const normalized = await normalizeRawPosting(posting, { titleSynonyms: settings.titleSynonyms, targetSeniorities: settings.targetSeniorities })

  if (!normalized.relevant) {
    return { error: `Imported, but this doesn't look like a product management role: ${normalized.discardReason}` }
  }

  const company = await prisma.company.upsert({ where: { name: normalized.companyName }, create: { name: normalized.companyName }, update: {} })

  const existing = await prisma.job.findFirst({ where: { OR: [{ applicationUrl: normalized.applicationUrl }, { originalUrl: normalized.originalUrl }] } })
  if (existing) {
    revalidatePath("/jobs")
    redirect(`/jobs/${existing.id}`)
  }

  const job = await prisma.job.create({
    data: {
      title: normalized.title,
      normalizedTitle: normalized.normalizedTitle,
      titleFamily: normalized.titleFamily,
      seniority: normalized.seniority,
      companyId: company.id,
      companyName: normalized.companyName,
      location: normalized.location,
      remoteStatus: normalized.remoteStatus,
      countriesJson: toJson(normalized.countries),
      salaryMin: normalized.salaryMin,
      salaryMax: normalized.salaryMax,
      salaryCurrency: normalized.salaryCurrency,
      salaryPeriod: normalized.salaryPeriod,
      compConfidence: normalized.compConfidence,
      employmentType: normalized.employmentType,
      department: normalized.department,
      applicationUrl: normalized.applicationUrl,
      originalUrl: normalized.originalUrl,
      source: normalized.source,
      sourceJobId: normalized.sourceJobId,
      datePosted: normalized.datePosted,
      datePostedConfidence: normalized.datePostedConfidence,
      description: normalized.description,
      requiredQualificationsJson: toJson(normalized.requirements.requiredQualifications),
      preferredQualificationsJson: toJson(normalized.requirements.preferredQualifications),
      responsibilitiesJson: toJson(normalized.requirements.responsibilities),
      requiredSkillsJson: toJson(normalized.requirements.requiredSkills),
      preferredSkillsJson: toJson(normalized.requirements.preferredSkills),
      industryExperienceJson: toJson(normalized.requirements.industryExperience),
      yearsExperienceMin: normalized.requirements.yearsExperienceMin,
      yearsExperienceMax: normalized.requirements.yearsExperienceMax,
      techRequirementsJson: toJson(normalized.requirements.techRequirements),
      methodologiesJson: toJson(normalized.requirements.methodologies),
      leadershipRequirements: normalized.requirements.leadershipRequirements,
      domainRequirementsJson: toJson(normalized.requirements.domainRequirements),
      workAuthRequirements: normalized.requirements.workAuthRequirements,
      keywordsJson: toJson(normalized.requirements.keywords),
      atsKeywordsJson: toJson(normalized.requirements.atsKeywords),
      rawJson: normalized.rawJson,
      dedupFingerprint: normalized.dedupFingerprint,
    },
  })
  await prisma.jobSourceRecord.create({
    data: { jobId: job.id, source: "manual-import", sourceJobId: url, sourceUrl: url },
  })
  await scoreJobById(job.id)

  revalidatePath("/jobs")
  redirect(`/jobs/${job.id}`)
}
