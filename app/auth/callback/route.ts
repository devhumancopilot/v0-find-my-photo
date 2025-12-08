import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/dashboard"
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
    }

    // Check if this is a password recovery event
    if (data?.session) {
      const { data: { user } } = await supabase.auth.getUser()

      // If user is recovering their password, redirect to reset-password page
      if (user?.recovery_sent_at) {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}${next}`)
}
