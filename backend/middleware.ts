import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Backend API server - no session management needed
  // API routes handle auth via headers/tokens
  // Just pass through all requests
  return NextResponse.next()
}

export const config = {
  // Only run on non-API routes (just the status page)
  // API routes should not have middleware interference
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
