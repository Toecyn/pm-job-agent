import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import { ScorePill } from "@/components/ui/ScorePill"
import { fromJsonArray } from "@/lib/utils/json"
import { JobActions } from "./JobActions"

export const dynamic = "force-dynamic"

function List({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-xs text-slate-400">None listed.</p>
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  )
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await prisma.job.findUnique({
    where: { id },
    include: { score: true, company: true, sourceRecords: true, applications: { include: { statusHistory: true } } },
  })
  if (!job) notFound()

  const application = job.applications[0]
  const intel = job.company?.intelJson ? JSON.parse(job.company.intelJson) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{job.title}</h1>
          <p className="text-sm text-slate-500">
            <Link href={job.companyId ? `/companies/${job.companyId}` : "#"} className="hover:underline">
              {job.companyName}
            </Link>{" "}
            · {job.location ?? job.remoteStatus} · {job.employmentType.replace("_", " ")} · via {job.source}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Posted: {job.datePostedConfidence === "known" && job.datePosted ? job.datePosted.toLocaleString() : "Unknown (not reliably determinable)"} · Discovered:{" "}
            {job.dateDiscovered.toLocaleString()}
          </p>
        </div>
        <JobActions jobId={job.id} hasScore={Boolean(job.score)} applicationId={application?.id} />
      </div>

      {job.score && (
        <Card>
          <div className="flex flex-wrap gap-2">
            <ScorePill label="Priority" score={job.score.priorityScore} />
            <ScorePill label="Fit" score={job.score.fitScore} />
            <ScorePill label="Quality" score={job.score.qualityScore} />
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">Band: {job.score.fitBand.replace(/_/g, " ")}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Why this matches</div>
              <List items={fromJsonArray<string>(job.score.reasonsJson)} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Potential concerns</div>
              <List items={fromJsonArray<string>(job.score.concernsJson)} />
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Required qualifications</CardTitle>
          <div className="mt-2">
            <List items={fromJsonArray<string>(job.requiredQualificationsJson)} />
          </div>
        </Card>
        <Card>
          <CardTitle>Preferred qualifications</CardTitle>
          <div className="mt-2">
            <List items={fromJsonArray<string>(job.preferredQualificationsJson)} />
          </div>
        </Card>
        <Card>
          <CardTitle>Responsibilities</CardTitle>
          <div className="mt-2">
            <List items={fromJsonArray<string>(job.responsibilitiesJson)} />
          </div>
        </Card>
        <Card>
          <CardTitle>Compensation &amp; requirements</CardTitle>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div>
              <dt className="inline font-medium">Salary: </dt>
              <dd className="inline">
                {job.compConfidence === "known" ? `${job.salaryCurrency ?? ""} ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"} / ${job.salaryPeriod ?? "year"}` : "Not disclosed"}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Experience: </dt>
              <dd className="inline">{job.yearsExperienceMin ?? "?"}–{job.yearsExperienceMax ?? "?"} years</dd>
            </div>
            <div>
              <dt className="inline font-medium">Work authorization: </dt>
              <dd className="inline">{job.workAuthRequirements ?? "Not specified"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {intel && (
        <Card>
          <CardTitle>Company intelligence</CardTitle>
          <p className="mt-2 text-sm text-slate-700">{intel.productOverview}</p>
        </Card>
      )}

      {application && (
        <Card>
          <CardTitle>Application status</CardTitle>
          <p className="mt-2 text-sm text-slate-700">
            Status: <span className="font-medium">{application.status.replace(/_/g, " ")}</span> —{" "}
            <Link href={`/applications/${application.id}`} className="text-slate-900 underline">
              View application
            </Link>
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Original job description</CardTitle>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
        <a href={job.originalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-slate-500 underline">
          View original posting ↗
        </a>
      </Card>
    </div>
  )
}
