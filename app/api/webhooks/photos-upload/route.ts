import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { triggerWebhook } from "@/lib/webhooks"

export async function POST(request: NextRequest) {
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

    const contentType = request.headers.get("content-type") || ""
    let n8nPayloads: Array<{
      name: string
      data: string
      type: string
      size: number
    }> = []

    // Validate file types and sizes
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

    // Handle JSON payload (new format - includes both manual and Google Photos)
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const images = body.images as Array<{
        name: string
        data: string
        type: string
        size: number
      }>

      if (!images || images.length === 0) {
        return NextResponse.json({ error: "No images provided" }, { status: 400 })
      }

      // Validate types and sizes
      for (const image of images) {
        if (!allowedTypes.includes(image.type)) {
          return NextResponse.json(
            { error: `Invalid file type: ${image.type}. Allowed types: ${allowedTypes.join(", ")}` },
            { status: 400 }
          )
        }
        if (image.size > maxFileSize) {
          return NextResponse.json(
            { error: `File ${image.name} exceeds maximum size of 10MB` },
            { status: 400 }
          )
        }
      }

      n8nPayloads = images
    }
    // Handle FormData payload (legacy format - backward compatibility)
    else {
      const formData = await request.formData()
      const files = formData.getAll("files") as File[]

      if (!files || files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 })
      }

      // Validate file types and sizes
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          return NextResponse.json(
            { error: `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(", ")}` },
            { status: 400 }
          )
        }
        if (file.size > maxFileSize) {
          return NextResponse.json(
            { error: `File ${file.name} exceeds maximum size of 10MB` },
            { status: 400 }
          )
        }
      }

      // Convert files to base64 and prepare for n8n
      for (const file of files) {
        try {
          const fileBuffer = await file.arrayBuffer()

          // Convert to base64 for n8n webhook
          const base64Data = Buffer.from(fileBuffer).toString("base64")

          // Prepare n8n payload in the expected format
          n8nPayloads.push({
            name: file.name,
            data: base64Data,
            type: file.type,
            size: file.size,
          })
        } catch (fileError) {
          console.error("Error processing file:", file.name, fileError)
          return NextResponse.json(
            { error: `Failed to process file: ${file.name}` },
            { status: 500 }
          )
        }
      }
    }

    // Trigger N8N webhook for image upload processing
    // n8n will handle ALL storage operations (Supabase Storage, Database inserts, etc.)
    if (n8nPayloads.length > 0) {
      try {
        const webhookPayload = {
          user_id: user.id,
          images: n8nPayloads,
          timestamp: new Date().toISOString(),
        }

        console.log(`Sending ${n8nPayloads.length} images to n8n webhook:`, {
          user_id: user.id,
          imageCount: n8nPayloads.length,
          imageStructure: n8nPayloads.map((img) => ({
            name: img.name,
            type: img.type,
            size: img.size,
            hasBase64Data: !!img.data,
            base64Length: img.data.length,
          })),
        })

        const webhookResult = await triggerWebhook(
          process.env.N8N_WEBHOOK_MANUAL_IMAGE_UPLOAD!,
          webhookPayload
        )

        if (!webhookResult.success) {
          console.error("N8N webhook failed:", webhookResult.error)
          return NextResponse.json(
            { error: "Failed to process images. Please try again." },
            { status: 500 }
          )
        }

        console.log(`Successfully sent ${n8nPayloads.length} images to n8n webhook`)

        return NextResponse.json({
          success: true,
          uploaded_count: n8nPayloads.length,
          message: "Images sent to processing pipeline",
        })
      } catch (webhookError) {
        console.error("N8N webhook trigger error:", webhookError)
        return NextResponse.json(
          { error: "Failed to trigger image processing" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      uploaded_count: 0,
      message: "No files processed",
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
