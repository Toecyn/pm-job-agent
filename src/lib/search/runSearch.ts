import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { getSettings } from "@/lib/config/settings"
import { computeSearchWindow, isWithinWindow } from "@/lib/scheduler/window"
import { pollableAdapters } from "@/lib/sources/registry"
import { normalizeRawPosting } from "@/lib/normalize/normalizer"
import { findDuplicateJob } from "@/lib/dedup/dedup"
import { scoreJobById } from "@/lib/scoring/scoreJob"
import { audit } from "@/lib/audit/logger"
import { notify } from "@/lib/notifications/service"
import type { SourceSearchParams } from "@/lib/types/job"

export interface RunSearchResult {
  searchRunId: string
  jobsFound: number
  jobsNew: number
  jobsDuplicate: number
  jobsDiscarded: number
  errors: string[]
}

/**
 * The Discover -> Analyze -> Score pipeline entry point (brief §2, Phase 1).
 * Called from the dashboard's "Run search now" action and from the
 * scheduler. Every adapter failure is isolated (brief §33) — one source
 * going down never aborts the run or blocks other sources.
 */
export async function runSearch(opts: { sources?: string[] } = {}): Promise<RunSearchResult> {
  const settings = await getSettings()
  const window = await computeSearchWindow({
    initialWindowDays: settings.initialWindowDays,
    overlapMinutes: settings.overlapMinutes,
  })

  const searchRun = await prisma.searchRun.create({
    data: {
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      sourcesQueriedJson: toJson(opts.sources ?? pollableAdapters.map((a) => a.id)),
      queriesJson: toJson(settings.jobTitles),
    },
  })
  await audit("search.started", "SearchRun", searchRun.id, { window })

  const searchParams: SourceSearchParams = {
    titles: settings.jobTitles,
    windowStart: window.windowStart.toISOString(),
    windowEnd: window.windowEnd.toISOString(),
    locations: settings.locations,
    countries: settings.countries,
    remotePreference: settings.remotePreference,
    boardTokens: [],
  }

  const adapters = opts.sources
    ? pollableAdapters.filter((a) => opts.sources!.includes(a.id))
    : pollableAdapters

  const errors: string[] = []
  const discarded: { title: string; companyName: string; source: string; reason: string }[] = []
  let jobsFound = 0
  let jobsNew = 0
  let jobsDuplicate = 0
  let adaptersFailed = 0

  for (const adapter of adapters) {
    try {
      const result = await adapter.search(searchParams)
      errors.push(...result.warnings)
      jobsFound += result.postings.length

      for (const raw of result.postings) {
        // Already discovered via this exact source before? Skip — not a new
        // discovery, not a cross-source duplicate, just a re-poll.
        const alreadySeen = await prisma.jobSourceRecord.findUnique({
          where: { source_sourceJobId: { source: raw.source, sourceJobId: raw.sourceJobId } },
        })
        if (alreadySeen) continue

        const normalized = await normalizeRawPosting(raw, {
          titleSynonyms: settings.titleSynonyms,
          targetSeniorities: settings.targetSeniorities,
        })

        const windowCheck = isWithinWindow(normalized.datePosted, normalized.datePostedConfidence, window)

        if (!normalized.relevant) {
          discarded.push({ title: raw.title, companyName: raw.companyName, source: raw.source, reason: normalized.discardReason ?? "not relevant" })
          continue
        }
        if (!windowCheck.withinWindow && windowCheck.certain) {
          discarded.push({
            title: raw.title,
            companyName: raw.companyName,
            source: raw.source,
            reason: `Posted ${normalized.datePosted?.toISOString()} — outside the current search window (${window.windowStart.toISOString()} to ${window.windowEnd.toISOString()}).`,
          })
          continue
        }

        const duplicateOfId = await findDuplicateJob({
          companyName: normalized.companyName,
          titleFamily: normalized.titleFamily,
          remoteStatus: normalized.remoteStatus,
          location: normalized.location,
          countries: normalized.countries,
          description: normalized.description,
          applicationUrl: normalized.applicationUrl,
          originalUrl: normalized.originalUrl,
        })

        if (duplicateOfId) {
          jobsDuplicate++
          await prisma.jobSourceRecord.create({
            data: {
              jobId: duplicateOfId,
              source: raw.source,
              sourceJobId: raw.sourceJobId,
              sourceUrl: raw.originalUrl,
              rawJson: toJson(raw.rawPayload ?? raw),
            },
          })
          continue
        }

        const company = await prisma.company.upsert({
          where: { name: normalized.companyName },
          create: { name: normalized.companyName },
          update: {},
        })

        if (company.excluded) {
          discarded.push({ title: raw.title, companyName: raw.companyName, source: raw.source, reason: "Company is on your exclude list." })
          continue
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
            dateUpdated: normalized.dateUpdated,
            dateClosing: normalized.dateClosing,
            description: normalized.description,
            requiredQualificationsJson: toJson(normalized.requirements.requiredQualifications),
            preferredQualificationsJson: toJson(normalized.requirements.preferredQualifications),
            responsibilitiesJson: toJson(normalized.requirements.responsibilities),
            requiredSkillsJson: toJson(normalized.requirements.requiredSkills),
            preferredSkillsJson: toJson(normalized.requirements.preferredSkills),
            industryExperienceJson: toJson(normalized.requirements.industryExperience),
            educationRequirements: normalized.requirements.educationRequirements,
            yearsExperienceMin: normalized.requirements.yearsExperienceMin,
            yearsExperienceMax: normalized.requirements.yearsExperienceMax,
            techRequirementsJson: toJson(normalized.requirements.techRequirements),
            methodologiesJson: toJson(normalized.requirements.methodologies),
            leadershipRequirements: normalized.requirements.leadershipRequirements,
            domainRequirementsJson: toJson(normalized.requirements.domainRequirements),
            workAuthRequirements: normalized.requirements.workAuthRequirements,
            travelRequirements: normalized.requirements.travelRequirements,
            keywordsJson: toJson(normalized.requirements.keywords),
            atsKeywordsJson: toJson(normalized.requirements.atsKeywords),
            rawJson: normalized.rawJson,
            dedupFingerprint: normalized.dedupFingerprint,
          },
        })

        await prisma.jobSourceRecord.create({
          data: {
            jobId: job.id,
            source: raw.source,
            sourceJobId: raw.sourceJobId,
            sourceUrl: raw.originalUrl,
            rawJson: toJson(raw.rawPayload ?? raw),
          },
        })

        jobsNew++

        try {
          const score = await scoreJobById(job.id)
          if (score.fitBand === "exceptional") {
            await notify({
              type: "new_exceptional_match",
              severity: "success",
              title: `Exceptional match: ${job.title} at ${job.companyName}`,
              message: `Fit score ${score.fitScore}/100. Discovered via ${raw.source}.`,
              meta: { jobId: job.id },
            })
          }
        } catch (scoreErr) {
          errors.push(`Scoring failed for job ${job.id}: ${(scoreErr as Error).message}`)
        }
      }
    } catch (err) {
      adaptersFailed++
      errors.push(`${adapter.id}: ${(err as Error).message}`)
    }
  }

  const finalStatus =
    adapters.length > 0 && adaptersFailed === adapters.length
      ? "failed"
      : errors.length > 0
        ? "partial"
        : "success"

  await prisma.searchRun.update({
    where: { id: searchRun.id },
    data: {
      completedAt: new Date(),
      status: finalStatus,
      jobsFound,
      jobsNew,
      jobsDuplicate,
      jobsDiscarded: discarded.length,
      errorsJson: toJson(errors),
      discardedJson: toJson(discarded.slice(0, 200)),
    },
  })

  await audit("search.completed", "SearchRun", searchRun.id, { jobsFound, jobsNew, jobsDuplicate, discarded: discarded.length, errors })

  return { searchRunId: searchRun.id, jobsFound, jobsNew, jobsDuplicate, jobsDiscarded: discarded.length, errors }
}
