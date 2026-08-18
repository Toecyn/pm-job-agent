import Link from "next/link"
import { prisma } from "@/lib/db/client"
import { Card } from "@/components/ui/Card"

export const dynamic = "force-dynamic"

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { jobs: true } } },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Companies</h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Open roles seen</th>
              <th className="px-4 py-2 text-left">Reputation</th>
              <th className="px-4 py-2 text-left">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/companies/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{c._count.jobs}</td>
                <td className="px-4 py-3 text-slate-500">{c.reputationScore ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.prioritized && <span className="mr-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Prioritized</span>}
                  {c.excluded && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Excluded</span>}
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No companies discovered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
