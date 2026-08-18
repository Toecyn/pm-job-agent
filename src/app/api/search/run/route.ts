import { NextResponse } from "next/server"
import { runSearch } from "@/lib/search/runSearch"

/**
 * REST entry point for triggering a search run over HTTP (e.g. from an
 * external scheduler that can't import the TypeScript lib directly, or a
 * webhook). Protected by the same session-cookie gate as the rest of the
 * dashboard (see src/proxy.ts) — scripts/runSearchOnce.ts is the
 * recommended path for OS-level cron since it doesn't need a running server
 * or auth at all.
 */
export async function POST() {
  try {
    const result = await runSearch()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
