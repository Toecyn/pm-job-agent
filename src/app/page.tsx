import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/client"

// Must never be statically prerendered — it queries the database, which may
// not be reachable at build time (e.g. Vercel builds without DB network
// access, or the DB simply isn't provisioned yet).
export const dynamic = "force-dynamic"

export default async function RootPage() {
  const profile = await prisma.candidateProfile.findFirst()
  redirect(profile?.onboardingComplete ? "/dashboard" : "/onboarding")
}
