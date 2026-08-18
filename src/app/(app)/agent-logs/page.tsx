import { prisma } from "@/lib/db/client"
import { Card, CardTitle } from "@/components/ui/Card"
import { fromJsonArray } from "@/lib/utils/json"
import { MarkAllReadButton } from "./MarkAllReadButton"

export const dynamic = "force-dynamic"

export default async function AgentLogsPage() {
  const [searchRuns, auditLogs, notifications] = await Promise.all([
    prisma.searchRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Agent Logs</h1>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Notifications</CardTitle>
          <MarkAllReadButton />
        </div>
        <ul className="mt-3 space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className={`rounded-md border p-2 text-sm ${n.read ? "border-slate-100 text-slate-500" : "border-slate-300 bg-slate-50"}`}>
              <span className="mr-2 text-xs font-semibold uppercase text-slate-400">{n.severity}</span>
              <strong>{n.title}</strong> — {n.message}
              <div className="text-xs text-slate-400">{n.createdAt.toLocaleString()}</div>
            </li>
          ))}
          {notifications.length === 0 && <p className="text-xs text-slate-400">No notifications yet.</p>}
        </ul>
      </Card>

      <Card>
        <CardTitle>Search history (brief §41)</CardTitle>
        <div className="mt-3 space-y-3">
          {searchRuns.map((run) => {
            const discarded = fromJsonArray<{ title: string; companyName: string; source: string; reason: string }>(run.discardedJson)
            const errors = fromJsonArray<string>(run.errorsJson)
            return (
              <div key={run.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{run.status}</strong> — {run.startedAt.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500">
                    {run.jobsFound} found · {run.jobsNew} new · {run.jobsDuplicate} duplicate · {run.jobsDiscarded} discarded
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Window: {run.windowStart.toLocaleString()} → {run.windowEnd.toLocaleString()} · Sources: {fromJsonArray<string>(run.sourcesQueriedJson).join(", ")}
                </div>
                {errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-amber-600">{errors.length} warning(s)/error(s)</summary>
                    <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                      {errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {discarded.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-500">{discarded.length} job(s) discarded — reasons</summary>
                    <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                      {discarded.slice(0, 20).map((d, i) => (
                        <li key={i}>
                          {d.title} at {d.companyName} ({d.source}): {d.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )
          })}
          {searchRuns.length === 0 && <p className="text-xs text-slate-400">No search runs yet.</p>}
        </div>
      </Card>

      <Card>
        <CardTitle>Audit trail (brief §32)</CardTitle>
        <div className="mt-3 max-h-[500px] space-y-1 overflow-y-auto">
          {auditLogs.map((log) => (
            <div key={log.id} className="border-b border-slate-100 py-1 text-xs text-slate-500">
              <span className="text-slate-400">{log.createdAt.toLocaleString()}</span> [{log.actor}] {log.action} {log.entityType}
              {log.entityId ? `#${log.entityId.slice(0, 8)}` : ""}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
