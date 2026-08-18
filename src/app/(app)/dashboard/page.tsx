import Link from "next/link"
import { prisma } from "@/lib/db/client"
import { StatTile, Card, CardTitle } from "@/components/ui/Card"
import { ScorePill } from "@/components/ui/ScorePill"
import { fromJsonArray } from "@/lib/utils/json"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 3600_000)

  const [jobsToday, jobsThisWeek, applicationsSubmitted, applications, topJobs, lastRun, avgScores] = await Promise.all([
    prisma.job.count({ where: { dateDiscovered: { gte: startOfDay } } }),
    prisma.job.count({ where: { dateDiscovered: { gte: startOfWeek } } }),
    prisma.application.count({ where: { submittedAt: { not: null } } }),
    prisma.application.count(),
    prisma.job.findMany({
      where: { score: { isNot: null } },
      include: { score: true },
      orderBy: { score: { priorityScore: "desc" } },
      take: 8,
    }),
    prisma.searchRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.jobScore.aggregate({ _avg: { fitScore: true, qualityScore: true } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Of all the PM opportunities available right now, here&apos;s what&apos;s worth your time.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Jobs discovered today" value={jobsToday} />
        <StatTile label="Jobs discovered this week" value={jobsThisWeek} />
        <StatTile label="Applications submitted" value={applicationsSubmitted} hint={`${applications} total in pipeline`} />
        <StatTile
          label="Avg fit / quality"
          value={`${Math.round(avgScores._avg.fitScore ?? 0)} / ${Math.round(avgScores._avg.qualityScore ?? 0)}`}
        />
      </div>

      {lastRun && (
        <Card>
          <CardTitle>Last search</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            {lastRun.status === "success" ? "✅" : lastRun.status === "partial" ? "⚠️" : "❌"} {lastRun.status} —{" "}
            {lastRun.jobsNew} new, {lastRun.jobsDuplicate} duplicate, {lastRun.jobsDiscarded} discarded ({lastRun.jobsFound} found).
            Window: {lastRun.windowStart.toLocaleString()} → {lastRun.windowEnd.toLocaleString()}.
          </p>
          <Link href="/agent-logs" className="mt-2 inline-block text-xs text-slate-500 underline">
            View full search history
          </Link>
        </Card>
      )}

      <Card>
        <CardTitle>Top-ranked opportunities</CardTitle>
        <div className="mt-3 divide-y divide-slate-100">
          {topJobs.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No scored jobs yet — run a search to get started.</p>}
          {topJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{job.title}</div>
                <div className="truncate text-xs text-slate-500">
                  {job.companyName} · {job.location ?? job.remoteStatus} · {fromJsonArray<string>(job.countriesJson).join(", ")}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <ScorePill label="Priority" score={job.score!.priorityScore} />
                <ScorePill label="Fit" score={job.score!.fitScore} />
                <ScorePill label="Quality" score={job.score!.qualityScore} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
