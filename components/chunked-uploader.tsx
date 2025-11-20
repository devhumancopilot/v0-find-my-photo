"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Pause, Play, RefreshCw } from 'lucide-react';
import { useUploadSession } from '@/lib/hooks/useUploadSession';
import { uploadPhotoChunkToSupabase, type ChunkUploadResult } from '@/lib/utils/supabase-chunked-upload';

interface ChunkedUploaderProps {
  files: File[];
  onComplete: (uploadedCount: number, failedCount: number) => void;
  onCancel?: () => void;
}

export function ChunkedUploader({ files, onComplete, onCancel }: ChunkedUploaderProps) {
  const {
    sessionState,
    isRecovering,
    initializeSession,
    updateChunkStatus,
    completeSession,
    pauseSession,
    resumeSession,
    clearSession,
    getNextPendingChunk,
    chunkSize,
  } = useUploadSession();

  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number | null>(null);
  const [currentPhotoInChunk, setCurrentPhotoInChunk] = useState(0);

  // Initialize or resume session
  useEffect(() => {
    if (files.length > 0 && !sessionState && !isRecovering) {
      initializeSession(files);
    }
  }, [files, sessionState, isRecovering, initializeSession]);

  // Auto-start upload if not recovering
  useEffect(() => {
    if (sessionState && !isRecovering && !isUploading && !isPaused) {
      startUpload();
    }
  }, [sessionState, isRecovering]);

  const startUpload = async () => {
    if (!sessionState || isUploading) return;

    setIsUploading(true);
    setIsPaused(false);

    try {
      await processChunks();

      // All chunks processed
      completeSession();
      const uploaded = sessionState.chunks.filter((c) => c.status === 'completed').reduce((sum, c) => sum + c.photoIds.length, 0);
      const failed = sessionState.chunks.filter((c) => c.status === 'failed').reduce((sum, c) => sum + c.photoIds.length, 0);

      onComplete(uploaded, failed);

    } catch (error) {
      console.error('[Chunked Uploader] Upload error:', error);
    } finally {
      setIsUploading(false);
      setCurrentChunkIndex(null);
    }
  };

  const processChunks = async () => {
    if (!sessionState) return;

    const numChunks = sessionState.chunks.length;

    for (let i = 0; i < numChunks; i++) {
      // Check if paused
      if (isPaused) {
        console.log('[Chunked Uploader] Paused at chunk', i);
        return;
      }

      const chunk = sessionState.chunks[i];

      // Skip completed chunks
      if (chunk.status === 'completed') {
        console.log(`[Chunked Uploader] Skipping completed chunk ${i}`);
        continue;
      }

      // Skip failed chunks that exceeded retry limit
      if (chunk.status === 'failed' && chunk.retryCount >= 3) {
        console.log(`[Chunked Uploader] Skipping failed chunk ${i} (max retries exceeded)`);
        continue;
      }

      setCurrentChunkIndex(i);

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, files.length);
      const chunkFiles = files.slice(start, end);

      console.log(`[Chunked Uploader] Processing chunk ${i + 1}/${numChunks} (photos ${start + 1}-${end})`);

      // Update chunk status to uploading
      updateChunkStatus(i, {
        status: 'uploading',
        startTime: Date.now(),
      });

      try {
        const result: ChunkUploadResult = await uploadPhotoChunkToSupabase(chunkFiles, i, {
          onChunkProgress: (chunkIdx, photoIdx, totalInChunk) => {
            setCurrentPhotoInChunk(photoIdx);
          },
        });

        // Update chunk with result
        updateChunkStatus(i, {
          status: result.success ? 'completed' : 'failed',
          photoIds: result.photoIds,
          blobUrls: result.storageUrls,
          dbPhotoIds: result.dbPhotoIds,
          error: result.errors.join(', ') || undefined,
          retryCount: result.retryCount,
          endTime: Date.now(),
        });

        console.log(`[Chunked Uploader] Chunk ${i} ${result.success ? 'completed' : 'failed'}`);

      } catch (error) {
        console.error(`[Chunked Uploader] Chunk ${i} error:`, error);

        updateChunkStatus(i, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          endTime: Date.now(),
        });
      }
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsUploading(false);
    pauseSession();
  };

  const handleResume = () => {
    setIsPaused(false);
    resumeSession();
    startUpload();
  };

  const handleCancel = () => {
    setIsUploading(false);
    setIsPaused(false);
    clearSession();
    onCancel?.();
  };

  const handleRetryFailed = async () => {
    if (!sessionState) return;

    // Reset failed chunks to pending
    sessionState.chunks.forEach((chunk, index) => {
      if (chunk.status === 'failed' && chunk.retryCount < 3) {
        updateChunkStatus(index, {
          status: 'pending',
        });
      }
    });

    // Restart upload
    setIsPaused(false);
    startUpload();
  };

  if (!sessionState) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Initializing upload session...</p>
        </CardContent>
      </Card>
    );
  }

  const completedChunks = sessionState.chunks.filter((c) => c.status === 'completed').length;
  const totalChunks = sessionState.chunks.length;
  const overallProgress = (completedChunks / totalChunks) * 100;
  const failedChunks = sessionState.chunks.filter((c) => c.status === 'failed' && c.retryCount >= 3);

  return (
    <div className="space-y-4">
      {/* Resume Prompt */}
      {isRecovering && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Resume Previous Upload?</p>
                <p className="text-sm">
                  {sessionState.uploadedCount} of {sessionState.totalPhotos} photos uploaded.{' '}
                  {sessionState.failedCount > 0 && `${sessionState.failedCount} failed.`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleResume}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Progress</CardTitle>
          <CardDescription>
            Chunk {completedChunks + 1} of {totalChunks} • {sessionState.uploadedCount} photos uploaded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Current Chunk Progress */}
          {currentChunkIndex !== null && isUploading && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>
                  Current Chunk (Photo {currentPhotoInChunk} of {Math.min(chunkSize, files.length - currentChunkIndex * chunkSize)})
                </span>
                <span className="text-blue-600">Uploading...</span>
              </div>
              <Progress value={(currentPhotoInChunk / chunkSize) * 100} className="h-2" />
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {isUploading && !isPaused && <span className="text-blue-600">⏫ Uploading...</span>}
              {isPaused && <span className="text-orange-600">⏸️ Paused</span>}
              {sessionState.status === 'completed' && (
                <span className="text-green-600 flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completed!
                </span>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2">
              {isUploading && !isPaused && (
                <Button size="sm" variant="outline" onClick={handlePause}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button size="sm" onClick={handleResume}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              {failedChunks.length > 0 && !isUploading && (
                <Button size="sm" variant="outline" onClick={handleRetryFailed}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Failed ({failedChunks.length})
                </Button>
              )}
            </div>
          </div>

          {/* Failed Chunks Warning */}
          {failedChunks.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {failedChunks.length} chunk(s) failed after 3 retries. You can retry them manually.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Chunk Details (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chunk Details (Dev Only)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs font-mono">
              {sessionState.chunks.map((chunk, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-20">Chunk {idx + 1}:</span>
                  <span
                    className={`w-24 ${
                      chunk.status === 'completed'
                        ? 'text-green-600'
                        : chunk.status === 'failed'
                        ? 'text-red-600'
                        : chunk.status === 'uploading'
                        ? 'text-blue-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {chunk.status}
                  </span>
                  <span className="text-muted-foreground">
                    {chunk.photoIds.length} photos • Retries: {chunk.retryCount}
                  </span>
                  {chunk.error && <span className="text-red-600 truncate">{chunk.error}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
