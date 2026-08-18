import Link from "next/link"
import { prisma } from "@/lib/db/client"
import { ScorePill } from "@/components/ui/ScorePill"
import { Card } from "@/components/ui/Card"

export const dynamic = "force-dynamic"

const FIT_BANDS = ["exceptional", "strong", "good", "possible", "do_not_apply"]

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string; source?: string }>
}) {
  const { band, source } = await searchParams

  const jobs = await prisma.job.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(band ? { score: { fitBand: band } } : {}),
    },
    include: { score: true },
    orderBy: [{ score: { priorityScore: "desc" } }, { dateDiscovered: "desc" }],
    take: 100,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Jobs</h1>
        <div className="flex gap-2 text-xs">
          {FIT_BANDS.map((b) => (
            <Link
              key={b}
              href={band === b ? "/jobs" : `/jobs?band=${b}`}
              className={`rounded-full border px-2.5 py-1 ${band === b ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
            >
              {b.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2 text-left">Salary</th>
              <th className="px-4 py-2 text-left">Posted</th>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">Scores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-slate-900 hover:underline">
                    {job.title}
                  </Link>
                  <div className="text-xs text-slate-400">{job.titleFamily.replace(/_/g, " ")} · {job.seniority}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{job.companyName}</td>
                <td className="px-4 py-3 text-slate-500">{job.location ?? job.remoteStatus}</td>
                <td className="px-4 py-3 text-slate-500">
                  {job.compConfidence === "known" && (job.salaryMin || job.salaryMax)
                    ? `${job.salaryCurrency ?? ""} ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"}`
                    : "Not disclosed"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {job.datePostedConfidence === "known" && job.datePosted ? job.datePosted.toLocaleDateString() : "Unknown"}
                </td>
                <td className="px-4 py-3 text-slate-500">{job.source}</td>
                <td className="px-4 py-3">
                  {job.score ? (
                    <div className="flex gap-1">
                      <ScorePill label="P" score={job.score.priorityScore} />
                      <ScorePill label="F" score={job.score.fitScore} />
                      <ScorePill label="Q" score={job.score.qualityScore} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Not scored</span>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No jobs yet — click &quot;Run search now&quot; above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
