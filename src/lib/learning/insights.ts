import { prisma } from "@/lib/db/client"

/**
 * Learning System (brief §25). Deliberately advisory-only: it computes real
 * outcome statistics and turns them into concrete, human-readable
 * suggestions, but never edits Settings itself. A suggestion becomes real
 * only when the user explicitly applies it (an ordinary, audited
 * updateSettings() call from the Analytics/Settings page) — "never
 * silently change important application behavior."
 */
export interface OutcomeStat {
  key: string
  applied: number
  interviewOrBetter: number
  offers: number
  rejected: number
  interviewRate: number
}

const INTERVIEW_STAGE_STATUSES = ["INTERVIEW", "FINAL_INTERVIEW", "OFFER"]

async function applicationsReachingInterview(): Promise<Set<string>> {
  const events = await prisma.applicationStatusEvent.findMany({
    where: { toStatus: { in: INTERVIEW_STAGE_STATUSES } },
    select: { applicationId: true },
  })
  return new Set(events.map((e) => e.applicationId))
}

function summarize(groups: Map<string, { applied: number; interview: number; offers: number; rejected: number }>): OutcomeStat[] {
  return Array.from(groups.entries())
    .map(([key, v]) => ({
      key,
      applied: v.applied,
      interviewOrBetter: v.interview,
      offers: v.offers,
      rejected: v.rejected,
      interviewRate: v.applied ? Math.round((v.interview / v.applied) * 100) : 0,
    }))
    .sort((a, b) => b.applied - a.applied)
}

export async function computeOutcomeStats() {
  const applications = await prisma.application.findMany({
    where: { status: { not: "DISCOVERED" }, submittedAt: { not: null } },
    include: { job: true, tailoredCv: true },
  })
  const interviewSet = await applicationsReachingInterview()

  const byTitleFamily = new Map<string, { applied: number; interview: number; offers: number; rejected: number }>()
  const bySource = new Map<string, { applied: number; interview: number; offers: number; rejected: number }>()
  const byCvVariant = new Map<string, { applied: number; interview: number; offers: number; rejected: number }>()
  const byCompany = new Map<string, { applied: number; interview: number; offers: number; rejected: number }>()

  const bump = (map: Map<string, { applied: number; interview: number; offers: number; rejected: number }>, key: string, reachedInterview: boolean, status: string) => {
    const entry = map.get(key) ?? { applied: 0, interview: 0, offers: 0, rejected: 0 }
    entry.applied++
    if (reachedInterview) entry.interview++
    if (status === "OFFER") entry.offers++
    if (status === "REJECTED") entry.rejected++
    map.set(key, entry)
  }

  for (const app of applications) {
    const reached = interviewSet.has(app.id)
    bump(byTitleFamily, app.job.titleFamily, reached, app.status)
    bump(bySource, app.job.source, reached, app.status)
    bump(byCvVariant, app.tailoredCv?.baseVariantKey ?? "unknown", reached, app.status)
    bump(byCompany, app.job.companyName, reached, app.status)
  }

  return {
    byTitleFamily: summarize(byTitleFamily),
    bySource: summarize(bySource),
    byCvVariant: summarize(byCvVariant),
    byCompany: summarize(byCompany),
    totalApplications: applications.length,
  }
}

export interface LearningSuggestion {
  id: string
  description: string
  rationale: string
  kind: "increase_title_priority" | "decrease_source_weight" | "flag_company" | "info"
}

const MIN_SAMPLE_SIZE = 5

export async function generateLearningSuggestions(): Promise<LearningSuggestion[]> {
  const stats = await computeOutcomeStats()
  const suggestions: LearningSuggestion[] = []

  if (stats.totalApplications < MIN_SAMPLE_SIZE) {
    suggestions.push({
      id: "insufficient-data",
      kind: "info",
      description: `Only ${stats.totalApplications} submitted application(s) so far.`,
      rationale: `Learning suggestions need at least ${MIN_SAMPLE_SIZE} submitted applications to be statistically meaningful — keep applying to unlock them.`,
    })
    return suggestions
  }

  const overallRate = Math.round(
    (stats.byTitleFamily.reduce((s, t) => s + t.interviewOrBetter, 0) / Math.max(1, stats.totalApplications)) * 100
  )

  for (const t of stats.byTitleFamily) {
    if (t.applied < MIN_SAMPLE_SIZE) continue
    if (t.interviewRate >= overallRate + 15) {
      suggestions.push({
        id: `title-up-${t.key}`,
        kind: "increase_title_priority",
        description: `Consider prioritizing "${t.key.replace(/_/g, " ")}" roles.`,
        rationale: `${t.interviewRate}% of your ${t.key.replace(/_/g, " ")} applications reached interview stage vs. ${overallRate}% overall (n=${t.applied}).`,
      })
    }
  }

  for (const s of stats.bySource) {
    if (s.applied < MIN_SAMPLE_SIZE) continue
    if (s.interviewRate <= Math.max(0, overallRate - 15)) {
      suggestions.push({
        id: `source-down-${s.key}`,
        kind: "decrease_source_weight",
        description: `"${s.key}" postings are underperforming.`,
        rationale: `Only ${s.interviewRate}% of applications sourced from ${s.key} reached interview stage vs. ${overallRate}% overall (n=${s.applied}).`,
      })
    }
  }

  for (const c of stats.byCompany) {
    if (c.applied >= 3 && c.rejected === c.applied) {
      suggestions.push({
        id: `company-flag-${c.key}`,
        kind: "flag_company",
        description: `${c.key} has rejected all ${c.applied} of your applications.`,
        rationale: "Consider whether continuing to apply here is a good use of effort, or whether your materials need a different angle for this company specifically.",
      })
    }
  }

  return suggestions
}
