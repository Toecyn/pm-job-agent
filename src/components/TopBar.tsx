"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { runSearchNowAction, logoutAction } from "@/app/_actions/appActions"

export function TopBar({ unreadCount }: { unreadCount: number }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-sm text-slate-500">{result ?? "Ready"}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setResult("Running search…")
              const r = await runSearchNowAction()
              setResult(`Search complete: ${r.jobsNew} new, ${r.jobsDuplicate} duplicate, ${r.jobsDiscarded} discarded (${r.jobsFound} found).`)
            })
          }
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "Searching…" : "Run search now"}
        </button>
        <Link href="/agent-logs" className="relative text-sm text-slate-500 hover:text-slate-900">
          Notifications
          {unreadCount > 0 && (
            <span className="absolute -right-3 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{unreadCount}</span>
          )}
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
