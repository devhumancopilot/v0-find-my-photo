import { createClient } from "@/lib/supabase/server"
import { triggerWebhook } from "@/lib/webhooks"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, selectedPhotos, coverImageUrl } = body

    // Create album
    const { data: album, error: albumError } = await supabase
      .from("albums")
      .insert({
        user_id: user.id,
        title,
        description,
        cover_image_url: coverImageUrl,
        photo_count: selectedPhotos.length,
        status: "active",
      })
      .select()
      .single()

    if (albumError) {
      console.error("[v0] Album creation failed:", albumError)
      return NextResponse.json({ error: "Failed to create album" }, { status: 500 })
    }

    // Create photo records
    const photoRecords = selectedPhotos.map((photo: { url: string; caption?: string }, index: number) => ({
      album_id: album.id,
      user_id: user.id,
      image_url: photo.url,
      caption: photo.caption || null,
      position: index,
    }))

    const { error: photosError } = await supabase.from("photos").insert(photoRecords)

    if (photosError) {
      console.error("[v0] Photos creation failed:", photosError)
      // Don't fail the request, album is already created
    }

    // Trigger n8n webhook
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_ALBUM_FINALIZED, {
      userId: user.id,
      albumId: album.id,
      title,
      photoCount: selectedPhotos.length,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      albumId: album.id,
      webhookTriggered: webhookResult.success,
    })
  } catch (error) {
    console.error("[v0] Album finalized webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
