import { prisma } from "@/lib/db/client"
import { fromJson, fromJsonArray, toJson } from "@/lib/utils/json"
import {
  DEFAULT_FIT_THRESHOLDS,
  DEFAULT_FIT_WEIGHTS,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_QUALITY_WEIGHTS,
} from "@/lib/types/scoring"
import { audit } from "@/lib/audit/logger"

export const DEFAULT_JOB_TITLES = [
  "Product Manager",
  "Senior Product Manager",
  "Product Lead",
  "Senior Product Lead",
  "Principal Product Manager",
  "Group Product Manager",
  "Product Owner",
  "Technical Product Manager",
  "Data Product Manager",
  "AI Product Manager",
  "GenAI Product Manager",
  "Platform Product Manager",
  "Digital Product Manager",
  "Product Strategy Lead",
]

// Title variants that should be treated as referring to the same family
// (brief §37) — seeds src/lib/normalize's semantic matcher.
export const DEFAULT_TITLE_SYNONYMS: Record<string, string> = {
  "sr product manager": "senior_product_manager",
  "sr. product manager": "senior_product_manager",
  "senior pm": "senior_product_manager",
  pm: "product_manager",
  "product lead": "product_lead",
  "lead product manager": "product_lead",
  "group pm": "group_product_manager",
  "gpm": "group_product_manager",
  "principal pm": "principal_product_manager",
  "technical pm": "technical_product_manager",
  "tpm": "technical_product_manager",
  "data pm": "data_product_manager",
  "ai pm": "ai_product_manager",
  "genai product manager": "ai_product_manager",
  "platform pm": "platform_product_manager",
  "digital pm": "digital_product_manager",
}

export interface ResolvedSettings {
  jobTitles: string[]
  titleSynonyms: Record<string, string>
  targetSeniorities: string[]
  minFitScore: number
  minQualityScore: number
  fitThresholds: typeof DEFAULT_FIT_THRESHOLDS
  fitWeights: typeof DEFAULT_FIT_WEIGHTS
  qualityWeights: typeof DEFAULT_QUALITY_WEIGHTS
  priorityWeights: typeof DEFAULT_PRIORITY_WEIGHTS
  locations: string[]
  countries: string[]
  remotePreference: string
  industries: string[]
  approvalMode: "MANUAL" | "REVIEW" | "AUTO"
  autoApplyMinFit: number
  autoApplyMinQuality: number
  initialWindowDays: number
  overlapMinutes: number
  searchFrequencyCron: string
  notificationPrefs: { channels: string[] }
  aiProvider: "openai" | "anthropic" | "null"
  aiModel: string
  coverLetterPreference: "always" | "if_required" | "never"
  followUpDelayDays: number
}

/** Ensures the singleton Settings row exists, creating it with defaults on first run. */
async function ensureSettingsRow() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return prisma.settings.create({
    data: {
      id: 1,
      jobTitlesJson: toJson(DEFAULT_JOB_TITLES),
      titleSynonymsJson: toJson(DEFAULT_TITLE_SYNONYMS),
    },
  })
}

export async function getSettings(): Promise<ResolvedSettings> {
  const row = await ensureSettingsRow()
  return {
    jobTitles: fromJsonArray<string>(row.jobTitlesJson).length
      ? fromJsonArray<string>(row.jobTitlesJson)
      : DEFAULT_JOB_TITLES,
    titleSynonyms: {
      ...DEFAULT_TITLE_SYNONYMS,
      ...fromJson<Record<string, string>>(row.titleSynonymsJson, {}),
    },
    targetSeniorities: fromJsonArray<string>(row.targetSenioritiesJson),
    minFitScore: row.minFitScore,
    minQualityScore: row.minQualityScore,
    fitThresholds: { ...DEFAULT_FIT_THRESHOLDS, ...fromJson(row.fitThresholdsJson, {}) },
    fitWeights: { ...DEFAULT_FIT_WEIGHTS, ...fromJson(row.fitWeightsJson, {}) },
    qualityWeights: { ...DEFAULT_QUALITY_WEIGHTS, ...fromJson(row.qualityWeightsJson, {}) },
    priorityWeights: { ...DEFAULT_PRIORITY_WEIGHTS, ...fromJson(row.priorityWeightsJson, {}) },
    locations: fromJsonArray<string>(row.locationsJson),
    countries: fromJsonArray<string>(row.countriesJson),
    remotePreference: row.remotePreference,
    industries: fromJsonArray<string>(row.industriesJson),
    approvalMode: row.approvalMode as ResolvedSettings["approvalMode"],
    autoApplyMinFit: row.autoApplyMinFit,
    autoApplyMinQuality: row.autoApplyMinQuality,
    initialWindowDays: row.initialWindowDays,
    overlapMinutes: row.overlapMinutes,
    searchFrequencyCron: row.searchFrequencyCron,
    notificationPrefs: fromJson(row.notificationPrefsJson, { channels: ["dashboard"] }),
    aiProvider: row.aiProvider as ResolvedSettings["aiProvider"],
    aiModel: row.aiModel,
    coverLetterPreference: row.coverLetterPreference as ResolvedSettings["coverLetterPreference"],
    followUpDelayDays: row.followUpDelayDays,
  }
}

/**
 * Partial update of settings. Every call is audited (brief §25 — "make
 * scoring weights visible and configurable" / "never silently change
 * important application behavior").
 */
export async function updateSettings(
  patch: Partial<ResolvedSettings>,
  actor: "user" | "system" = "user"
): Promise<ResolvedSettings> {
  await ensureSettingsRow()
  const data: Record<string, unknown> = {}
  if (patch.jobTitles) data.jobTitlesJson = toJson(patch.jobTitles)
  if (patch.titleSynonyms) data.titleSynonymsJson = toJson(patch.titleSynonyms)
  if (patch.targetSeniorities) data.targetSenioritiesJson = toJson(patch.targetSeniorities)
  if (patch.minFitScore !== undefined) data.minFitScore = patch.minFitScore
  if (patch.minQualityScore !== undefined) data.minQualityScore = patch.minQualityScore
  if (patch.fitThresholds) data.fitThresholdsJson = toJson(patch.fitThresholds)
  if (patch.fitWeights) data.fitWeightsJson = toJson(patch.fitWeights)
  if (patch.qualityWeights) data.qualityWeightsJson = toJson(patch.qualityWeights)
  if (patch.priorityWeights) data.priorityWeightsJson = toJson(patch.priorityWeights)
  if (patch.locations) data.locationsJson = toJson(patch.locations)
  if (patch.countries) data.countriesJson = toJson(patch.countries)
  if (patch.remotePreference) data.remotePreference = patch.remotePreference
  if (patch.industries) data.industriesJson = toJson(patch.industries)
  if (patch.approvalMode) data.approvalMode = patch.approvalMode
  if (patch.autoApplyMinFit !== undefined) data.autoApplyMinFit = patch.autoApplyMinFit
  if (patch.autoApplyMinQuality !== undefined) data.autoApplyMinQuality = patch.autoApplyMinQuality
  if (patch.initialWindowDays !== undefined) data.initialWindowDays = patch.initialWindowDays
  if (patch.overlapMinutes !== undefined) data.overlapMinutes = patch.overlapMinutes
  if (patch.searchFrequencyCron) data.searchFrequencyCron = patch.searchFrequencyCron
  if (patch.notificationPrefs) data.notificationPrefsJson = toJson(patch.notificationPrefs)
  if (patch.aiProvider) data.aiProvider = patch.aiProvider
  if (patch.aiModel !== undefined) data.aiModel = patch.aiModel
  if (patch.coverLetterPreference) data.coverLetterPreference = patch.coverLetterPreference
  if (patch.followUpDelayDays !== undefined) data.followUpDelayDays = patch.followUpDelayDays

  await prisma.settings.update({ where: { id: 1 }, data })
  await audit("settings.update", "Settings", "1", { patch }, actor)
  return getSettings()
}
