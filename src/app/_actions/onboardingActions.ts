"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { encryptJson } from "@/lib/security/crypto"
import { getAiProvider } from "@/lib/ai/provider"
import { updateSettings } from "@/lib/config/settings"
import { audit } from "@/lib/audit/logger"

const ParsedCvSchema = z.object({
  fullName: z.string().default("UNKNOWN"),
  currentRole: z.string().default("UNKNOWN"),
  currentCompany: z.string().default("UNKNOWN"),
  yearsExperience: z.number().optional(),
  pmSkills: z.array(z.string()).default([]),
  technicalSkills: z.array(z.string()).default([]),
  summary: z.string().default(""),
})
export type ParsedCv = z.infer<typeof ParsedCvSchema>

/** Brief §51 steps 2-4: upload/paste master CV -> parse -> review before it becomes part of the profile. */
export async function parseCvAction(rawText: string): Promise<ParsedCv> {
  if (!rawText.trim()) return ParsedCvSchema.parse({})
  const provider = await getAiProvider()
  if (provider.id === "null") {
    // Deterministic fallback: we don't guess structured fields from free text without an AI provider —
    // mark them UNKNOWN so the user fills them in explicitly rather than trusting a naive regex guess.
    return ParsedCvSchema.parse({ summary: rawText.slice(0, 300) })
  }
  try {
    return await provider.complete({
      system:
        "Extract structured fields from this CV/resume text. Use ONLY information present in the text. If a field " +
        'isn\'t determinable, use "UNKNOWN" (or omit numeric fields). Never invent details.',
      prompt: rawText.slice(0, 8000),
      schema: ParsedCvSchema,
      temperature: 0,
    })
  } catch {
    return ParsedCvSchema.parse({ summary: rawText.slice(0, 300) })
  }
}

export interface CreateProfileState {
  error?: string
}

export async function createProfileAction(_prev: CreateProfileState, formData: FormData): Promise<CreateProfileState> {
  const email = String(formData.get("email") ?? "").trim()
  const fullName = String(formData.get("fullName") ?? "").trim()
  if (!email || !fullName) return { error: "Name and email are required." }

  const split = (name: string) =>
    String(formData.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

  const profile = await prisma.candidateProfile.upsert({
    where: { email },
    update: {},
    create: {
      email,
      fullName,
      location: String(formData.get("location") ?? "") || null,
      linkedinUrl: String(formData.get("linkedinUrl") ?? "") || null,
      portfolioUrl: String(formData.get("portfolioUrl") ?? "") || null,
      githubUrl: String(formData.get("githubUrl") ?? "") || null,
      currentRole: String(formData.get("currentRole") ?? "") || null,
      currentCompany: String(formData.get("currentCompany") ?? "") || null,
      yearsExperience: formData.get("yearsExperience") ? Number(formData.get("yearsExperience")) : null,
      workModePreference: String(formData.get("workModePreference") ?? "any"),
      willingToRelocate: formData.get("willingToRelocate") === "on",
      workAuthorizationEnc: encryptJson({
        country: String(formData.get("authCountry") ?? "") || "UNKNOWN",
        status: String(formData.get("authStatus") ?? "") || "UNKNOWN",
        sponsorshipNeeded: formData.get("sponsorshipNeeded") === "on",
      }),
      preferredCompEnc: encryptJson({
        min: formData.get("compMin") ? Number(formData.get("compMin")) : undefined,
        max: formData.get("compMax") ? Number(formData.get("compMax")) : undefined,
        currency: String(formData.get("compCurrency") ?? "USD"),
        period: "year",
      }),
      preferredCountriesJson: toJson(split("preferredCountries")),
      preferredCitiesJson: toJson(split("preferredCities")),
      targetSeniorityJson: toJson(split("targetSeniority")),
      industriesJson: toJson(split("industries")),
      targetIndustriesJson: toJson(split("industries")),
      pmSkillsJson: toJson(split("pmSkills")),
      technicalSkillsJson: toJson(split("technicalSkills")),
      masterCvRaw: String(formData.get("masterCvRaw") ?? "") || null,
      onboardingComplete: true,
    },
  })

  for (const key of ["master", "general_pm", "senior_pm", "ai_pm", "data_pm", "technical_pm", "product_strategy"]) {
    await prisma.cvVariant.upsert({
      where: { profileId_key: { profileId: profile.id, key } },
      update: {},
      create: { profileId: profile.id, key, label: key.replace(/_/g, " "), contentJson: toJson({}), isMaster: key === "master" },
    })
  }

  await updateSettings(
    {
      jobTitles: split("jobTitles"),
      locations: split("preferredCities"),
      countries: split("preferredCountries"),
      targetSeniorities: split("targetSeniority"),
      industries: split("industries"),
      remotePreference: String(formData.get("workModePreference") ?? "any"),
      approvalMode: String(formData.get("approvalMode") ?? "REVIEW") as never,
    },
    "user"
  )

  await audit("onboarding.completed", "CandidateProfile", profile.id, {}, "user")
  redirect("/dashboard")
}
