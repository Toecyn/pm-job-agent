"use client"

import { useTransition } from "react"
import { markAllNotificationsReadAction } from "@/app/_actions/appActions"

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition()
  return (
    <button disabled={pending} onClick={() => startTransition(() => markAllNotificationsReadAction())} className="text-xs text-slate-500 underline disabled:opacity-40">
      Mark all read
    </button>
  )
}
