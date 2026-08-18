import { clsx } from "clsx"

const STATUS_COLORS: Record<string, string> = {
  DISCOVERED: "bg-slate-100 text-slate-600",
  ANALYZED: "bg-slate-100 text-slate-600",
  SCORED: "bg-slate-100 text-slate-600",
  SHORTLISTED: "bg-sky-100 text-sky-700",
  CV_TAILORED: "bg-sky-100 text-sky-700",
  APPLICATION_PREPARED: "bg-indigo-100 text-indigo-700",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-800",
  APPLIED: "bg-blue-100 text-blue-700",
  ASSESSMENT: "bg-purple-100 text-purple-700",
  RECRUITER_SCREEN: "bg-purple-100 text-purple-700",
  INTERVIEW: "bg-violet-100 text-violet-700",
  FINAL_INTERVIEW: "bg-violet-100 text-violet-700",
  OFFER: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-slate-100 text-slate-500",
  GHOSTED: "bg-slate-100 text-slate-500",
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600")}>
      {status.replace(/_/g, " ")}
    </span>
  )
}
