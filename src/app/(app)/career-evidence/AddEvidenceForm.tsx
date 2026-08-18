"use client"

import { useActionState } from "react"
import { addEvidenceAction, type AddEvidenceState } from "@/app/_actions/evidenceActions"
import { evidenceTypes } from "@/lib/types/enums"

const initialState: AddEvidenceState = {}

export function AddEvidenceForm() {
  const [state, action, pending] = useActionState(addEvidenceAction, initialState)

  return (
    <form action={action} className="mt-3 grid gap-3 md:grid-cols-2">
      <input name="title" placeholder="Title (e.g. Launched X)" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <select name="evidenceType" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        {evidenceTypes.map((t) => (
          <option key={t} value={t}>
            {t.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <input name="company" placeholder="Company (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input name="roleTitle" placeholder="Role title (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input name="startDate" type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input name="endDate" type="date" placeholder="Leave blank if current" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <textarea name="description" placeholder="Full truthful description, including any real numbers" required rows={3} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
      <input name="tags" placeholder="Tags, comma separated (e.g. ai, leadership, fintech)" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
      <div className="md:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Saving…" : "Add evidence"}
        </button>
        {state.error && <span className="ml-3 text-sm text-red-600">{state.error}</span>}
        {state.success && <span className="ml-3 text-sm text-emerald-600">Added.</span>}
      </div>
    </form>
  )
}
