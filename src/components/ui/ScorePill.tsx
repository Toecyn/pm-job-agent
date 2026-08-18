import { clsx } from "clsx"

function colorFor(score: number): string {
  if (score >= 90) return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (score >= 80) return "bg-green-100 text-green-800 border-green-200"
  if (score >= 70) return "bg-amber-100 text-amber-800 border-amber-200"
  if (score >= 60) return "bg-orange-100 text-orange-800 border-orange-200"
  return "bg-slate-100 text-slate-600 border-slate-200"
}

export function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", colorFor(score))}>
      {label} {score}
    </span>
  )
}
