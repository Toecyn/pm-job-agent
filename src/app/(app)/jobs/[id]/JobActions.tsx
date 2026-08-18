"use client"

import { useTransition } from "react"
import Link from "next/link"
import { scoreJobAction, prepareApplicationAction } from "@/app/_actions/jobActions"

export function JobActions({ jobId, hasScore, applicationId }: { jobId: string; hasScore: boolean; applicationId?: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex shrink-0 gap-2">
      {!hasScore && (
        <button
          onClick={() => startTransition(() => scoreJobAction(jobId))}
          disabled={pending}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Score this job
        </button>
      )}
      {applicationId ? (
        <Link href={`/applications/${applicationId}`} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
          View application
        </Link>
      ) : (
        <button
          onClick={() => startTransition(() => prepareApplicationAction(jobId))}
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "Preparing…" : "Prepare application"}
        </button>
      )}
    </div>
  )
}
