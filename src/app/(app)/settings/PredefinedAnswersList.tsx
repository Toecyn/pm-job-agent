"use client"

import { useTransition } from "react"
import { deletePredefinedAnswerAction } from "@/app/_actions/settingsActions"

interface Answer {
  id: string
  category: string
  question: string
  answer: string
}

export function PredefinedAnswersList({ answers }: { answers: Answer[] }) {
  const [pending, startTransition] = useTransition()
  return (
    <ul className="mt-3 space-y-2">
      {answers.map((a) => (
        <li key={a.id} className="rounded-md border border-slate-200 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">{a.category.replace(/_/g, " ")}</div>
              <div className="font-medium text-slate-800">{a.question}</div>
              <div className="text-slate-600">{a.answer}</div>
            </div>
            <button disabled={pending} onClick={() => startTransition(() => deletePredefinedAnswerAction(a.id))} className="shrink-0 text-xs text-red-500 underline">
              Remove
            </button>
          </div>
        </li>
      ))}
      {answers.length === 0 && <p className="text-xs text-slate-400">No predefined answers yet.</p>}
    </ul>
  )
}
