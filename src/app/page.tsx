import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/client"

export default async function RootPage() {
  const profile = await prisma.candidateProfile.findFirst()
  redirect(profile?.onboardingComplete ? "/dashboard" : "/onboarding")
}
