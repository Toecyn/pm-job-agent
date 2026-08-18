"use client"

import { useTransition } from "react"
import { toggleWatchedBoardAction, deleteWatchedBoardAction } from "@/app/_actions/settingsActions"

interface Board {
  id: string
  source: string
  token: string
  label: string
  enabled: boolean
}

export function WatchedBoardsList({ boards }: { boards: Board[] }) {
  const [pending, startTransition] = useTransition()
  return (
    <ul className="mt-3 space-y-1">
      {boards.map((b) => (
        <li key={b.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
          <span>
            <strong>{b.source}</strong> · {b.label} <span className="text-xs text-slate-400">({b.token})</span>
          </span>
          <span className="flex gap-2">
            <button disabled={pending} onClick={() => startTransition(() => toggleWatchedBoardAction(b.id))} className="text-xs text-slate-500 underline">
              {b.enabled ? "Disable" : "Enable"}
            </button>
            <button disabled={pending} onClick={() => startTransition(() => deleteWatchedBoardAction(b.id))} className="text-xs text-red-500 underline">
              Remove
            </button>
          </span>
        </li>
      ))}
      {boards.length === 0 && <p className="text-xs text-slate-400">No boards added yet.</p>}
    </ul>
  )
}
