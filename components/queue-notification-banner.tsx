"use client"

import { useState, useRef, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Sparkles, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getBackendAPIURL } from "@/lib/config"

interface QueueNotificationBannerProps {
  pendingCount: number
  processingCount: number
}

// Configuration for auto-retry behavior
const MAX_CONSECUTIVE_FAILURES = 3
const MAX_TOTAL_BATCHES = 50
const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 10000
const REQUEST_TIMEOUT = 290000

export function QueueNotificationBanner({ pendingCount, processingCount }: QueueNotificationBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [batchCount, setBatchCount] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  // Real-time queue counts
  const [currentPendingCount, setCurrentPendingCount] = useState(pendingCount)
  const [currentProcessingCount, setCurrentProcessingCount] = useState(processingCount)

  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasAutoStartedRef = useRef(false)

  // Update current counts when props change
  useEffect(() => {
    setCurrentPendingCount(pendingCount)
    setCurrentProcessingCount(processingCount)
  }, [pendingCount, processingCount])

  // Auto-start processing when photos are uploaded
  useEffect(() => {
    const shouldAutoStart = currentPendingCount > 0 && !isProcessing && !hasAutoStartedRef.current

    if (shouldAutoStart) {
      hasAutoStartedRef.current = true
      console.log('[Queue Banner] Auto-starting processing for', currentPendingCount, 'photos')

      // Small delay to ensure component is mounted
      setTimeout(() => {
        setIsProcessing(true)
        setBatchCount(0)
        setConsecutiveFailures(0)

        toast.info("🎉 Your photos are uploading!", {
          description: "We'll process them automatically. Sit back and relax!",
          duration: 3000,
        })

        processQueue(false, 0)
      }, 500)
    }
  }, [currentPendingCount])

  // Start/stop SSE connection for real-time updates
  useEffect(() => {
    if (isProcessing) {
      console.log('[Queue Banner] Starting SSE connection for real-time updates')

      // Use fetch-based SSE to support credentials
      let isActive = true
      const connectSSE = async () => {
        try {
          const response = await fetch(getBackendAPIURL('/api/photos/queue-status-stream'), {
            credentials: 'include',
          })

          if (!response.ok) {
            throw new Error(`SSE connection failed: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

          if (!reader) {
            throw new Error('No readable stream available')
          }

          let buffer = ''

          while (isActive) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue

              const dataMatch = line.match(/^data: (.+)$/m)
              if (dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1])
                  console.log('[Queue Banner] SSE update:', data)
                  setCurrentPendingCount(data.pending_count)
                  setCurrentProcessingCount(data.processing_count)
                } catch (error) {
                  console.error('[Queue Banner] Error parsing SSE data:', error)
                }
              }
            }
          }
        } catch (error) {
          console.error('[Queue Banner] SSE error:', error)
        }
      }

      connectSSE()

      return () => {
        isActive = false
        console.log('[Queue Banner] Closing SSE connection')
      }
    }
  }, [isProcessing])

  // Detect when processing is complete
  useEffect(() => {
    if (isProcessing && currentPendingCount === 0 && currentProcessingCount === 0) {
      console.log('[Queue Banner] Processing complete!')

      toast.success("🎉 All Done!", {
        description: "Your photos are ready to explore!",
        duration: 5000,
      })

      setIsProcessing(false)
      setBatchCount(0)
      setConsecutiveFailures(0)
      hasAutoStartedRef.current = false

      setTimeout(() => {
        router.refresh()
      }, 1000)
    }
  }, [isProcessing, currentPendingCount, currentProcessingCount, router])

  // Don't show if no items or dismissed
  if ((currentPendingCount === 0 && currentProcessingCount === 0) || isDismissed) {
    return null
  }

  const processQueue = async (isRetry = false, currentFailures = 0): Promise<void> => {
    const newBatchCount = batchCount + 1

    // Safety check
    if (newBatchCount > MAX_TOTAL_BATCHES) {
      console.error(`[Queue Banner] Reached maximum batch limit`)
      toast.error("Processing Limit Reached", {
        description: "Please restart for remaining photos.",
        duration: 7000,
      })
      setIsProcessing(false)
      setBatchCount(0)
      setConsecutiveFailures(0)
      hasAutoStartedRef.current = false
      return
    }

    // Check consecutive failures
    if (currentFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`[Queue Banner] Too many consecutive failures`)
      toast.error("Oops! Something went wrong", {
        description: "Please try again.",
        duration: 7000,
      })
      setIsProcessing(false)
      setBatchCount(0)
      setConsecutiveFailures(0)
      hasAutoStartedRef.current = false
      return
    }

    try {
      abortControllerRef.current = new AbortController()
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort()
      }, REQUEST_TIMEOUT)

      const response = await fetch(getBackendAPIURL('/api/photos/process-queue-worker'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      // Update batch count
      setBatchCount(newBatchCount)
      setConsecutiveFailures(0)

      // Note: The worker processes all photos in background
      // The SSE connection provides real-time status updates
      console.log(`[Queue Banner] Worker triggered successfully. Processing in background...`)

      // The SSE stream will detect when processing is complete
      // (see the useEffect that monitors currentPendingCount and currentProcessingCount)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.warning("Processing Paused", {
          description: "Restart to continue.",
          duration: 5000,
        })
        setIsProcessing(false)
        setBatchCount(0)
        setConsecutiveFailures(0)
        hasAutoStartedRef.current = false
        return
      }

      const newFailures = currentFailures + 1
      setConsecutiveFailures(newFailures)

      if (newFailures < MAX_CONSECUTIVE_FAILURES) {
        const retryDelay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, newFailures),
          MAX_RETRY_DELAY
        )

        await new Promise(resolve => setTimeout(resolve, retryDelay))
        await processQueue(true, newFailures)
      } else {
        toast.error("Processing Failed", {
          description: error instanceof Error ? error.message : "Unknown error",
          duration: 7000,
        })

        setIsProcessing(false)
        setBatchCount(0)
        setConsecutiveFailures(0)
        hasAutoStartedRef.current = false
      }
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  // Total items being processed
  const totalItems = currentPendingCount + currentProcessingCount

  return (
    <Alert className="relative mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AlertDescription>
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 animate-spin" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 mb-1">
                  Processing your photos...
                </p>
                <div className="space-y-1">
                  <p className="text-sm text-blue-800">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      AI processing happening at the backend
                    </span>
                  </p>
                  {totalItems > 0 && (
                    <p className="text-xs text-blue-700">
                      {totalItems} photo{totalItems !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
              </div>
            </div>
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2">
          {!isProcessing && (
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  )
}
