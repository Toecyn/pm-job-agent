import Link from "next/link"
import { prisma } from "@/lib/db/client"
import { Card } from "@/components/ui/Card"
import { StatusPill } from "@/components/ui/StatusPill"
import { ScorePill } from "@/components/ui/ScorePill"

export const dynamic = "force-dynamic"

const PIPELINE_ORDER = [
  "AWAITING_APPROVAL",
  "APPLICATION_PREPARED",
  "APPLIED",
  "ASSESSMENT",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "SHORTLISTED",
  "CV_TAILORED",
  "SCORED",
  "ANALYZED",
  "DISCOVERED",
  "REJECTED",
  "WITHDRAWN",
  "GHOSTED",
]

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    include: { job: { include: { score: true } } },
    orderBy: { updatedAt: "desc" },
  })

  const sorted = [...applications].sort((a, b) => PIPELINE_ORDER.indexOf(a.status) - PIPELINE_ORDER.indexOf(b.status))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Applications</h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Scores</th>
              <th className="px-4 py-2 text-left">Applied via</th>
              <th className="px-4 py-2 text-left">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/applications/${app.id}`} className="font-medium text-slate-900 hover:underline">
                    {app.job.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{app.job.companyName}</td>
                <td className="px-4 py-3">
                  <StatusPill status={app.status} />
                </td>
                <td className="px-4 py-3">
                  {app.job.score && (
                    <div className="flex gap-1">
                      <ScorePill label="F" score={app.job.score.fitScore} />
                      <ScorePill label="Q" score={app.job.score.qualityScore} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{app.appliedVia ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{app.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No applications yet — prepare one from a job&apos;s detail page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
