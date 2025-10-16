import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const albumTitle = formData.get("albumTitle") as string
    const albumDescription = formData.get("albumDescription") as string

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    console.log("[v0] Processing", files.length, "files for user", user.id)

    // Upload files to Supabase Storage
    const uploadedFiles = []
    for (const file of files) {
      const fileName = `${user.id}/${Date.now()}-${file.name}`
      const fileBuffer = await file.arrayBuffer()

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("photos")
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error("[v0] Upload error:", uploadError)
        continue
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(fileName)

      uploadedFiles.push({
        fileName: uploadData.path,
        publicUrl,
        originalName: file.name,
        size: file.size,
        type: file.type,
      })

      // Insert photo metadata into database
      const { error: dbError } = await supabase.from("photos").insert({
        user_id: user.id,
        image_url: publicUrl,
        thumbnail_url: publicUrl, // In production, generate thumbnail
        metadata: {
          source_type: "manual_upload",
          original_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
        },
      })

      if (dbError) {
        console.error("[v0] Database insert error:", dbError)
      }
    }

    // Trigger n8n webhook for processing
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_PHOTO_SOURCE_CONNECTED
    if (n8nWebhookUrl) {
      try {
        await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "photos_uploaded",
            user_id: user.id,
            album_title: albumTitle,
            album_description: albumDescription,
            uploaded_files: uploadedFiles,
            timestamp: new Date().toISOString(),
          }),
        })
        console.log("[v0] n8n webhook triggered successfully")
      } catch (webhookError) {
        console.error("[v0] n8n webhook error:", webhookError)
        // Don't fail the request if webhook fails
      }
    }

    return NextResponse.json({
      success: true,
      uploaded_count: uploadedFiles.length,
      files: uploadedFiles,
    })
  } catch (error) {
    console.error("[v0] Photos upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
