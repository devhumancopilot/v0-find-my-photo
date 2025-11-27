import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Validate the upload request
        console.log('[Upload Token] Generating token for:', pathname);
        console.log('[Upload Token] User ID:', user.id);
        console.log('[Upload Token] Client payload:', clientPayload);

        // Extract file info from client payload
        const { filename, fileType, fileSize } = clientPayload as {
          filename?: string;
          fileType?: string;
          fileSize?: number;
        };

        // Validate file type (must be an image)
        if (fileType && !fileType.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }

        // Validate file size (max 100MB for client uploads)
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
        if (fileSize && fileSize > MAX_FILE_SIZE) {
          throw new Error('File size exceeds 100MB limit');
        }

        // Return metadata to be stored with the blob
        return {
          allowedContentTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
          tokenPayload: JSON.stringify({
            userId: user.id,
            filename: filename || 'unknown',
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs after the upload completes
        console.log('[Upload Token] Upload completed:', blob.url);
        console.log('[Upload Token] Token payload:', tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[Upload Token] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload token generation failed' },
      { status: 400 }
    );
  }
}
