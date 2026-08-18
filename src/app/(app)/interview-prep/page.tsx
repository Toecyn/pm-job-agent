import Link from "next/link"
import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import type { InterviewPrepContent } from "@/lib/interviewPrep/generate"

export const dynamic = "force-dynamic"

export default async function InterviewPrepPage() {
  const packages = await prisma.interviewPrepPackage.findMany({
    include: { application: { include: { job: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Interview Preparation</h1>
        <p className="text-sm text-slate-500">Generated automatically when you request it from an application (brief §23). Includes STAR stories drawn from your Career Evidence database.</p>
      </div>
      {packages.length === 0 && <Card><p className="text-sm text-slate-400">No interview prep packages generated yet — open an application and click &quot;Generate interview prep&quot;.</p></Card>}
      {packages.map((pkg) => {
        const content = JSON.parse(pkg.contentJson) as InterviewPrepContent
        return (
          <Card key={pkg.id}>
            <div className="flex items-center justify-between">
              <CardTitle>
                {pkg.application.job.title} at {pkg.application.job.companyName}
              </CardTitle>
              <Link href={`/applications/${pkg.applicationId}`} className="text-xs text-slate-500 underline">
                View application
              </Link>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Role analysis</div>
                <p className="mt-1 text-sm text-slate-700">{content.roleAnalysis}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Likely questions</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {content.likelyQuestions.map((q, i) => (
                    <li key={i}>
                      <span className="text-xs text-slate-400">[{q.category.replace(/_/g, " ")}]</span> {q.question}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">STAR stories</div>
                <ul className="mt-1 space-y-2 text-sm text-slate-700">
                  {content.starStories.map((s, i) => (
                    <li key={i} className="rounded-md bg-slate-50 p-2 text-xs">
                      <strong>S:</strong> {s.situation} <strong>T:</strong> {s.task} <strong>A:</strong> {s.action} <strong>R:</strong> {s.result}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Questions to ask them</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {content.questionsToAsk.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
              {content.weaknesses.length > 0 && (
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Potential weaknesses &amp; how to address them</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {content.weaknesses.map((w, i) => (
                      <li key={i}>
                        <strong>{w.concern}</strong> — {w.mitigation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
