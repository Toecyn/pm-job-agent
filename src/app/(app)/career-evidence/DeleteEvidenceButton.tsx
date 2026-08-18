"use client"

import { useTransition } from "react"
import { deleteEvidenceAction } from "@/app/_actions/evidenceActions"

export function DeleteEvidenceButton({ evidenceId }: { evidenceId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Remove this evidence entry? Any CV bullets already generated from it stay as-is, but it won't be used again.")) {
          startTransition(() => deleteEvidenceAction(evidenceId))
        }
      }}
      className="shrink-0 text-xs text-slate-400 hover:text-red-600 disabled:opacity-40"
    >
      Remove
    </button>
  )
}
