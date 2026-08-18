import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import { CompanyActions } from "./CompanyActions"

export const dynamic = "force-dynamic"

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await prisma.company.findUnique({ where: { id }, include: { jobs: { orderBy: { dateDiscovered: "desc" } } } })
  if (!company) notFound()

  const intel = company.intelJson ? JSON.parse(company.intelJson) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{company.name}</h1>
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-slate-500 underline">
              {company.website}
            </a>
          )}
        </div>
        <CompanyActions companyId={company.id} excluded={company.excluded} prioritized={company.prioritized} hasWebsite={Boolean(company.website)} />
      </div>

      {intel ? (
        <Card>
          <CardTitle>Company intelligence</CardTitle>
          <dl className="mt-3 space-y-3 text-sm text-slate-700">
            <Field label="Product overview" value={intel.productOverview} />
            <Field label="Business model" value={intel.businessModel} />
            <Field label="Funding status" value={intel.fundingStatus} />
            <Field label="Product strategy notes" value={intel.productStrategyNotes} />
            <ListField label="Recent announcements" items={intel.recentAnnouncements} />
            <ListField label="Competitors" items={intel.competitors} />
            <ListField label="Technology" items={intel.technologyStack} />
            <ListField label="Culture indicators" items={intel.cultureIndicators} />
            <ListField label="Challenges" items={intel.challenges} />
          </dl>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-slate-500">No company intelligence gathered yet. {company.website ? "Click \"Gather intelligence\" above." : "Add a website above first."}</p>
        </Card>
      )}

      <Card>
        <CardTitle>Roles seen at {company.name}</CardTitle>
        <div className="mt-3 divide-y divide-slate-100">
          {company.jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="block py-2 text-sm text-slate-700 hover:underline">
              {job.title} — {job.location ?? job.remoteStatus}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function ListField({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd>
        <ul className="list-disc pl-5">
          {items.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
      </dd>
    </div>
  )
}
