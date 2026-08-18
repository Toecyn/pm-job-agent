import type { ReactNode } from "react"
import { Nav } from "@/components/Nav"
import { TopBar } from "@/components/TopBar"
import { prisma } from "@/lib/db/client"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const unreadCount = await prisma.notification.count({ where: { read: false } })

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-sm font-semibold text-slate-900">PM Job Agent</div>
          <div className="text-xs text-slate-400">Personal job search assistant</div>
        </div>
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar unreadCount={unreadCount} />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  )
}
