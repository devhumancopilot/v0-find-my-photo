import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      title,
      description,
      bug_type,
      severity,
      page_url,
      browser_info,
      screenshot_urls = []
    } = body

    // Validate required fields
    if (!title || !description || !bug_type || !severity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Insert bug report
    const { data: bugReport, error: insertError } = await supabase
      .from("bug_reports")
      .insert({
        user_id: user.id,
        title,
        description,
        bug_type,
        severity,
        page_url,
        browser_info,
        screenshot_urls,
        status: "open"
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting bug report:", insertError)
      return NextResponse.json(
        { error: "Failed to submit bug report" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: bugReport
    })

  } catch (error) {
    console.error("Error in bug report endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user's bug reports
    const { data: bugReports, error: fetchError } = await supabase
      .from("bug_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      console.error("Error fetching bug reports:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch bug reports" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: bugReports
    })

  } catch (error) {
    console.error("Error in bug report endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
