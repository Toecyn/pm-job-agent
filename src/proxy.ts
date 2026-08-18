import { NextResponse, type NextRequest } from "next/server"
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session"

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` (see AGENTS.md /
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md).
// Protects every dashboard route behind the single-user login (brief §32).
const PUBLIC_PATHS = ["/login", "/api/health"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const email = verifySessionToken(token)

  if (!email) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
