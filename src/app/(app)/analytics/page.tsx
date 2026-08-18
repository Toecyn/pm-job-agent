import { prisma } from "@/lib/db/client"
import { Card, CardTitle, StatTile } from "@/components/ui/Card"
import { computeOutcomeStats, generateLearningSuggestions } from "@/lib/learning/insights"

export const dynamic = "force-dynamic"

function StatTable({ title, rows }: { title: string; rows: { key: string; applied: number; interviewOrBetter: number; offers: number; interviewRate: number }[] }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <table className="mt-2 w-full text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1 text-left">Segment</th>
            <th className="py-1 text-right">Applied</th>
            <th className="py-1 text-right">Interview+</th>
            <th className="py-1 text-right">Offers</th>
            <th className="py-1 text-right">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100">
              <td className="py-1">{r.key.replace(/_/g, " ")}</td>
              <td className="py-1 text-right">{r.applied}</td>
              <td className="py-1 text-right">{r.interviewOrBetter}</td>
              <td className="py-1 text-right">{r.offers}</td>
              <td className="py-1 text-right">{r.interviewRate}%</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-400">
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}

export default async function AnalyticsPage() {
  const [stats, suggestions, searchRuns, dupCount] = await Promise.all([
    computeOutcomeStats(),
    generateLearningSuggestions(),
    prisma.searchRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.job.count({ where: { isDuplicateOfId: { not: null } } }),
  ])

  const totalDuplicatesDetected = searchRuns.reduce((s, r) => s + r.jobsDuplicate, 0) + dupCount

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total applications tracked" value={stats.totalApplications} />
        <StatTile label="Duplicate postings detected" value={totalDuplicatesDetected} />
        <StatTile label="Search runs logged" value={searchRuns.length} />
        <StatTile
          label="Overall interview rate"
          value={`${Math.round((stats.byTitleFamily.reduce((s, t) => s + t.interviewOrBetter, 0) / Math.max(1, stats.totalApplications)) * 100)}%`}
        />
      </div>

      <Card>
        <CardTitle>Learning suggestions</CardTitle>
        <p className="mt-1 text-xs text-slate-500">Advisory only — nothing here changes your scoring automatically (brief §25). Apply a suggestion from Settings if you agree with it.</p>
        <ul className="mt-3 space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="font-medium text-slate-900">{s.description}</div>
              <div className="text-xs text-slate-500">{s.rationale}</div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <StatTable title="By job title family" rows={stats.byTitleFamily} />
        <StatTable title="By source" rows={stats.bySource} />
        <StatTable title="By CV variant" rows={stats.byCvVariant} />
        <StatTable title="By company" rows={stats.byCompany} />
      </div>
    </div>
  )
}
