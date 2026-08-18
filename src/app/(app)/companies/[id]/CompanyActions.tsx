"use client"

import { useState, useTransition } from "react"
import { toggleCompanyFlagAction, updateCompanyWebsiteAction } from "@/app/_actions/companyActions"
import { gatherCompanyIntelAction } from "@/app/_actions/jobActions"

export function CompanyActions({
  companyId,
  excluded,
  prioritized,
  hasWebsite,
}: {
  companyId: string
  excluded: boolean
  prioritized: boolean
  hasWebsite: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [website, setWebsite] = useState("")

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasWebsite && (
        <div className="flex gap-1">
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
          <button
            disabled={pending || !website}
            onClick={() => startTransition(() => updateCompanyWebsiteAction(companyId, website))}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
          >
            Save
          </button>
        </div>
      )}
      <button disabled={pending} onClick={() => startTransition(() => gatherCompanyIntelAction(companyId))} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
        Gather intelligence
      </button>
      <button
        disabled={pending}
        onClick={() => startTransition(() => toggleCompanyFlagAction(companyId, "prioritized"))}
        className={`rounded-md px-3 py-1.5 text-xs font-medium ${prioritized ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700"}`}
      >
        {prioritized ? "Prioritized ✓" : "Prioritize"}
      </button>
      <button
        disabled={pending}
        onClick={() => startTransition(() => toggleCompanyFlagAction(companyId, "excluded"))}
        className={`rounded-md px-3 py-1.5 text-xs font-medium ${excluded ? "bg-red-600 text-white" : "border border-slate-300 text-slate-700"}`}
      >
        {excluded ? "Excluded ✓" : "Exclude"}
      </button>
    </div>
  )
}
