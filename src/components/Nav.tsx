"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { clsx } from "clsx"

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/cvs", label: "CVs" },
  { href: "/career-evidence", label: "Career Evidence" },
  { href: "/companies", label: "Companies" },
  { href: "/interview-prep", label: "Interview Prep" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
  { href: "/agent-logs", label: "Agent Logs" },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(link.href + "/")
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
