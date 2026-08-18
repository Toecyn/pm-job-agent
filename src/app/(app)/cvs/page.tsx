import Link from "next/link"
import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import { ScorePill } from "@/components/ui/ScorePill"

export const dynamic = "force-dynamic"

export default async function CvsPage() {
  const [variants, tailored] = await Promise.all([
    prisma.cvVariant.findMany({ orderBy: { key: "asc" } }),
    prisma.tailoredCV.findMany({ include: { job: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">CVs</h1>
        <p className="text-sm text-slate-500">A master CV plus specialized base variants (brief §11) — every tailored CV below is generated fresh from your Career Evidence database for a specific job, never edited directly.</p>
      </div>

      <Card>
        <CardTitle>Base variants</CardTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {variants.map((v) => (
            <div key={v.id} className="rounded-md border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-900">{v.label}</div>
              <div className="text-xs text-slate-500">{v.summaryTemplate}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Tailored CVs generated</CardTitle>
        <div className="mt-3 divide-y divide-slate-100">
          {tailored.map((cv) => (
            <Link key={cv.id} href={`/jobs/${cv.jobId}`} className="flex items-center justify-between py-3 hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {cv.job.title} <span className="text-slate-400">at</span> {cv.job.companyName}
                </div>
                <div className="text-xs text-slate-500">Variant: {cv.baseVariantKey.replace(/_/g, " ")} · {cv.createdAt.toLocaleString()}</div>
              </div>
              {cv.atsScore !== null && <ScorePill label="ATS" score={cv.atsScore ?? 0} />}
            </Link>
          ))}
          {tailored.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No tailored CVs generated yet.</p>}
        </div>
      </Card>
    </div>
  )
}
