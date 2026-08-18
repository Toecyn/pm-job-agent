import { notFound } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import { ScorePill } from "@/components/ui/ScorePill"
import { StatusPill } from "@/components/ui/StatusPill"
import { fromJsonArray } from "@/lib/utils/json"
import { ApprovalPanel } from "./ApprovalPanel"
import { AnswerEditor } from "./AnswerEditor"

export const dynamic = "force-dynamic"

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      job: { include: { score: true, company: true } },
      tailoredCv: { include: { bullets: true } },
      coverLetter: true,
      answers: { include: { sources: { include: { evidence: true } } } },
      approvalDecisions: { orderBy: { decidedAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      followUps: true,
      interviewPrep: true,
    },
  })
  if (!application) notFound()

  const validation = application.validationJson ? JSON.parse(application.validationJson) : []
  const ats = application.tailoredCv?.atsBreakdownJson ? JSON.parse(application.tailoredCv.atsBreakdownJson) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {application.job.title} <span className="text-slate-400">at</span> {application.job.companyName}
          </h1>
          <p className="text-sm text-slate-500">
            {application.job.location ?? application.job.remoteStatus} ·{" "}
            {application.job.compConfidence === "known" ? `${application.job.salaryCurrency ?? ""} ${application.job.salaryMin ?? "?"}–${application.job.salaryMax ?? "?"}` : "Salary not disclosed"}
          </p>
        </div>
        <StatusPill status={application.status} />
      </div>

      {application.job.score && (
        <Card>
          <div className="flex flex-wrap gap-2">
            <ScorePill label="Priority" score={application.job.score.priorityScore} />
            <ScorePill label="Fit" score={application.job.score.fitScore} />
            <ScorePill label="Quality" score={application.job.score.qualityScore} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Why this role matches me</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {fromJsonArray<string>(application.job.score.reasonsJson).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Potential concerns</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {fromJsonArray<string>(application.job.score.concernsJson).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Validation checks</CardTitle>
        <p className="mt-1 text-xs text-slate-500">{application.validationPassed ? "✅ Passed all checks" : "⚠️ One or more checks need attention"}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {validation.map((c: { name: string; passed: boolean; message: string }) => (
            <li key={c.name} className={c.passed ? "text-slate-600" : "text-red-600"}>
              {c.passed ? "✓" : "✗"} {c.message}
            </li>
          ))}
        </ul>
      </Card>

      <ApprovalPanel
        applicationId={application.id}
        status={application.status}
        approvalStatus={application.approvalStatus}
        applicationUrl={application.job.applicationUrl}
        companyId={application.job.companyId}
        automationSource={application.job.source}
      />

      {application.tailoredCv && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>CV used ({application.tailoredCv.baseVariantKey.replace(/_/g, " ")})</CardTitle>
            {application.tailoredCv.atsScore !== null && <ScorePill label="ATS" score={application.tailoredCv.atsScore ?? 0} />}
          </div>
          {ats && (
            <p className="mt-1 text-xs text-slate-500">
              Keyword coverage {ats.keywordCoverage}%. Missing: {ats.missingKeywords.slice(0, 8).join(", ") || "none"}.
            </p>
          )}
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{application.tailoredCv.renderedText}</pre>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500">Evidence traceability ({application.tailoredCv.bullets.length} bullets)</summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {application.tailoredCv.bullets.map((b) => (
                <li key={b.id}>
                  {b.verifierPassed ? "✓" : "⚠"} [{b.section}] {b.bulletText}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      {application.coverLetter && (
        <Card>
          <CardTitle>Cover letter</CardTitle>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{application.coverLetter.content}</p>
        </Card>
      )}

      {application.answers.length > 0 && (
        <Card>
          <CardTitle>Application answers</CardTitle>
          <div className="mt-3 space-y-4">
            {application.answers.map((a) => (
              <AnswerEditor
                key={a.id}
                answerId={a.id}
                question={a.question}
                answer={a.answer}
                isSensitive={a.isSensitive}
                requiresApproval={a.requiresApproval}
                wasUserProvided={a.wasUserProvided}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Application history</CardTitle>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {application.statusHistory.map((h) => (
            <li key={h.id}>
              {h.createdAt.toLocaleString()} — {h.fromStatus ? `${h.fromStatus} → ` : ""}
              {h.toStatus} {h.reason ? `(${h.reason})` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
