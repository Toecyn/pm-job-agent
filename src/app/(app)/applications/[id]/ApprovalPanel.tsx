"use client"

import { useState, useTransition } from "react"
import { approvalDecisionAction, markAppliedManuallyAction, runAutomationAction, generateInterviewPrepAction } from "@/app/_actions/applicationActions"

export function ApprovalPanel({
  applicationId,
  status,
  approvalStatus,
  applicationUrl,
  automationSource,
}: {
  applicationId: string
  status: string
  approvalStatus: string | null
  applicationUrl: string
  companyId: string | null
  automationSource: string
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const canDecide = status === "AWAITING_APPROVAL"
  const canMarkApplied = status === "AWAITING_APPROVAL" && approvalStatus === "approved"
  const automatable = ["greenhouse", "lever", "ashby"].includes(automationSource)

  const act = (fn: () => Promise<unknown>, label: string) =>
    startTransition(async () => {
      setMessage(`${label}…`)
      await fn()
      setMessage(`${label} done.`)
    })

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-900">Human approval checkpoint</h2>
        {message && <span className="text-xs text-amber-700">{message}</span>}
      </div>
      <p className="mt-1 text-xs text-amber-800">
        Nothing is ever submitted without your explicit approval (unless AUTO mode is enabled and this application qualifies under your rules).
        Current approval status: <strong>{approvalStatus ?? "pending"}</strong>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!canDecide || pending} onClick={() => act(() => approvalDecisionAction(applicationId, "approve"), "Approve")} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Approve
        </button>
        <button disabled={!canDecide || pending} onClick={() => act(() => approvalDecisionAction(applicationId, "reject"), "Reject")} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Reject
        </button>
        <button disabled={!canDecide || pending} onClick={() => act(() => approvalDecisionAction(applicationId, "skip"), "Skip")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40">
          Skip for now
        </button>
        <button disabled={!canDecide || pending} onClick={() => act(() => approvalDecisionAction(applicationId, "blacklist_company"), "Blacklist company")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40">
          Blacklist company
        </button>
        <button disabled={!canDecide || pending} onClick={() => act(() => approvalDecisionAction(applicationId, "blacklist_role"), "Blacklist role")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40">
          Blacklist role type
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber-200 pt-3">
        <a href={applicationUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-900 underline">
          Open application URL ↗
        </a>
        {automatable && (
          <button
            disabled={pending}
            onClick={() => act(() => runAutomationAction(applicationId), "Automation run")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
          >
            Run browser automation (fills form; requires AUTOMATION_ENABLED)
          </button>
        )}
        <button
          disabled={!canMarkApplied || pending}
          onClick={() => act(() => markAppliedManuallyAction(applicationId), "Marked applied")}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
        >
          I applied manually — mark as applied
        </button>
        <button
          disabled={pending}
          onClick={() => act(() => generateInterviewPrepAction(applicationId), "Interview prep generated")}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
        >
          Generate interview prep
        </button>
      </div>
    </div>
  )
}
