import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ChunkProgress {
  index: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  photoIds: string[];
  blobUrls: string[];
  dbPhotoIds?: number[];
  error?: string;
  retryCount: number;
  startTime?: number;
  endTime?: number;
}

export interface UploadSessionState {
  sessionId: string;
  totalPhotos: number;
  uploadedCount: number;
  failedCount: number;
  status: 'idle' | 'in_progress' | 'completed' | 'failed' | 'paused';
  chunks: ChunkProgress[];
  errors: string[];
  startTime: number;
  lastUpdateTime: number;
}

const STORAGE_KEY = 'upload_session_state';
const CHUNK_SIZE = 15; // Upload 15 photos per chunk for optimal performance

export function useUploadSession() {
  const [sessionState, setSessionState] = useState<UploadSessionState | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = loadSessionFromStorage();
    if (savedSession && savedSession.status === 'in_progress') {
      setSessionState(savedSession);
      setIsRecovering(true);
    }
  }, []);

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (sessionState) {
      saveSessionToStorage(sessionState);
    }
  }, [sessionState]);

  const initializeSession = useCallback((files: File[]): string => {
    const sessionId = uuidv4();
    const totalPhotos = files.length;
    const numChunks = Math.ceil(totalPhotos / CHUNK_SIZE);

    const chunks: ChunkProgress[] = Array.from({ length: numChunks }, (_, index) => ({
      index,
      status: 'pending' as const,
      photoIds: [],
      blobUrls: [],
      retryCount: 0,
    }));

    const newSession: UploadSessionState = {
      sessionId,
      totalPhotos,
      uploadedCount: 0,
      failedCount: 0,
      status: 'in_progress',
      chunks,
      errors: [],
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
    };

    setSessionState(newSession);
    setIsRecovering(false);

    // Save to database
    saveSessionToDatabase(newSession).catch(console.error);

    console.log(`[Upload Session] Initialized: ${sessionId} with ${totalPhotos} photos in ${numChunks} chunks`);

    return sessionId;
  }, []);

  const updateChunkStatus = useCallback((
    chunkIndex: number,
    updates: Partial<ChunkProgress>
  ) => {
    setSessionState((prev) => {
      if (!prev) return prev;

      const updatedChunks = [...prev.chunks];
      updatedChunks[chunkIndex] = {
        ...updatedChunks[chunkIndex],
        ...updates,
      };

      // Update counters
      let uploadedCount = 0;
      let failedCount = 0;

      updatedChunks.forEach((chunk) => {
        if (chunk.status === 'completed') {
          uploadedCount += chunk.photoIds.length;
        } else if (chunk.status === 'failed') {
          failedCount += chunk.photoIds.length;
        }
      });

      const updatedSession: UploadSessionState = {
        ...prev,
        chunks: updatedChunks,
        uploadedCount,
        failedCount,
        lastUpdateTime: Date.now(),
      };

      // Update database periodically (every 5 chunks or if status changed)
      if (chunkIndex % 5 === 0 || updates.status === 'completed' || updates.status === 'failed') {
        saveSessionToDatabase(updatedSession).catch(console.error);
      }

      return updatedSession;
    });
  }, []);

  const completeSession = useCallback(() => {
    setSessionState((prev) => {
      if (!prev) return prev;

      const completed: UploadSessionState = {
        ...prev,
        status: 'completed',
        lastUpdateTime: Date.now(),
      };

      saveSessionToDatabase(completed).catch(console.error);

      // Clear localStorage after successful completion
      setTimeout(() => {
        clearSessionFromStorage();
      }, 5000);

      console.log(`[Upload Session] Completed: ${prev.uploadedCount}/${prev.totalPhotos} uploaded`);

      return completed;
    });
  }, []);

  const failSession = useCallback((error: string) => {
    setSessionState((prev) => {
      if (!prev) return prev;

      const failed: UploadSessionState = {
        ...prev,
        status: 'failed',
        errors: [...prev.errors, error],
        lastUpdateTime: Date.now(),
      };

      saveSessionToDatabase(failed).catch(console.error);

      console.error(`[Upload Session] Failed: ${error}`);

      return failed;
    });
  }, []);

  const pauseSession = useCallback(() => {
    setSessionState((prev) => {
      if (!prev) return prev;

      const paused: UploadSessionState = {
        ...prev,
        status: 'paused',
        lastUpdateTime: Date.now(),
      };

      saveSessionToDatabase(paused).catch(console.error);

      console.log(`[Upload Session] Paused`);

      return paused;
    });
  }, []);

  const resumeSession = useCallback(() => {
    setSessionState((prev) => {
      if (!prev) return prev;

      const resumed: UploadSessionState = {
        ...prev,
        status: 'in_progress',
        lastUpdateTime: Date.now(),
      };

      setIsRecovering(false);

      console.log(`[Upload Session] Resumed`);

      return resumed;
    });
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(null);
    setIsRecovering(false);
    clearSessionFromStorage();
  }, []);

  const getNextPendingChunk = useCallback((): number | null => {
    if (!sessionState) return null;

    const pendingChunk = sessionState.chunks.find(
      (chunk) => chunk.status === 'pending' || (chunk.status === 'failed' && chunk.retryCount < 3)
    );

    return pendingChunk ? pendingChunk.index : null;
  }, [sessionState]);

  const getFailedChunks = useCallback((): number[] => {
    if (!sessionState) return [];

    return sessionState.chunks
      .filter((chunk) => chunk.status === 'failed')
      .map((chunk) => chunk.index);
  }, [sessionState]);

  return {
    sessionState,
    isRecovering,
    initializeSession,
    updateChunkStatus,
    completeSession,
    failSession,
    pauseSession,
    resumeSession,
    clearSession,
    getNextPendingChunk,
    getFailedChunks,
    chunkSize: CHUNK_SIZE,
  };
}

// Helper functions for localStorage persistence
function saveSessionToStorage(session: UploadSessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('[Upload Session] Failed to save to localStorage:', error);
  }
}

function loadSessionFromStorage(): UploadSessionState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('[Upload Session] Failed to load from localStorage:', error);
  }
  return null;
}

function clearSessionFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[Upload Session] Failed to clear localStorage:', error);
  }
}

// Helper function for database persistence
async function saveSessionToDatabase(session: UploadSessionState) {
  try {
    const response = await fetch('/api/upload/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.sessionId,
        total_photos: session.totalPhotos,
        uploaded_count: session.uploadedCount,
        failed_count: session.failedCount,
        status: session.status,
        chunks: session.chunks,
        errors: session.errors,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save session: ${response.statusText}`);
    }

    console.log(`[Upload Session] Saved to database: ${session.sessionId}`);
  } catch (error) {
    console.error('[Upload Session] Failed to save to database:', error);
    // Don't throw - localStorage is the primary backup
  }
}
