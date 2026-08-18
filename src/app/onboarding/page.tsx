import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { OnboardingForm } from "./OnboardingForm"

// Must never be statically prerendered — it queries the database at request
// time; see src/app/page.tsx for why.
export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const existing = await prisma.candidateProfile.findFirst()
  if (existing?.onboardingComplete) redirect("/dashboard")

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Welcome — let&apos;s set up your profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        This is a one-time setup (brief §51). Paste your CV to prefill fields, review, then configure your target roles and locations. Everything here is editable later from Settings.
      </p>
      <OnboardingForm defaultEmail={process.env.AUTH_USER_EMAIL ?? "you@example.com"} />
    </div>
  )
}
