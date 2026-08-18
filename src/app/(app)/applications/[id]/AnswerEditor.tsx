"use client"

import { useState, useTransition } from "react"
import { updateAnswerAction } from "@/app/_actions/applicationActions"

export function AnswerEditor({
  answerId,
  question,
  answer,
  isSensitive,
  requiresApproval,
  wasUserProvided,
}: {
  answerId: string
  question: string
  answer: string | null
  isSensitive: boolean
  requiresApproval: boolean
  wasUserProvided: boolean
}) {
  const [value, setValue] = useState(answer ?? "")
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <div className={`rounded-md border p-3 ${requiresApproval && !answer ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-slate-700">{question}</span>
        {isSensitive && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">Sensitive</span>}
        {wasUserProvided && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Predefined answer</span>}
        {requiresApproval && !answer && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Needs your input</span>}
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
        rows={3}
        className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm"
        placeholder={requiresApproval ? "This question requires personal judgment — please provide an answer." : ""}
      />
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateAnswerAction(answerId, value)
            setSaved(true)
          })
        }
        className="mt-1 text-xs text-slate-500 underline disabled:opacity-40"
      >
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save edit"}
      </button>
    </div>
  )
}
