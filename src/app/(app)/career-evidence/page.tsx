import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import { fromJsonArray } from "@/lib/utils/json"
import { AddEvidenceForm } from "./AddEvidenceForm"
import { DeleteEvidenceButton } from "./DeleteEvidenceButton"

export const dynamic = "force-dynamic"

export default async function CareerEvidencePage() {
  const profile = await prisma.candidateProfile.findFirst()
  const evidence = profile
    ? await prisma.careerEvidence.findMany({ where: { profileId: profile.id }, orderBy: [{ company: "asc" }, { startDate: "desc" }] })
    : []

  const grouped = new Map<string, typeof evidence>()
  for (const e of evidence) {
    const key = e.company ?? "Other (certifications, publications, etc.)"
    grouped.set(key, [...(grouped.get(key) ?? []), e])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Career Evidence</h1>
        <p className="text-sm text-slate-500">
          The master source of truth (brief §5) — every CV bullet, cover letter claim, and application answer traces back to one of these rows. Add evidence here rather than editing a CV directly.
        </p>
      </div>

      <Card>
        <CardTitle>Add evidence</CardTitle>
        <AddEvidenceForm />
      </Card>

      {Array.from(grouped.entries()).map(([company, items]) => (
        <Card key={company}>
          <CardTitle>{company}</CardTitle>
          <div className="mt-3 space-y-3">
            {items.map((e) => (
              <div key={e.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{e.title}</div>
                    <div className="text-xs text-slate-500">
                      {e.roleTitle} {e.startDate ? `· ${e.startDate.toISOString().slice(0, 7)}` : ""}
                      {e.endDate ? ` – ${e.endDate.toISOString().slice(0, 7)}` : e.roleTitle ? " – Present" : ""} · {e.evidenceType}
                    </div>
                  </div>
                  <DeleteEvidenceButton evidenceId={e.id} />
                </div>
                <p className="mt-1 text-sm text-slate-700">{e.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {fromJsonArray<string>(e.tagsJson).map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
