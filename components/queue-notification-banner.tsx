"use client"

import { useState, useRef } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface QueueNotificationBannerProps {
  pendingCount: number
  processingCount: number
}

// Configuration for auto-retry behavior
const MAX_CONSECUTIVE_FAILURES = 3 // Stop after 3 consecutive batch failures
const MAX_TOTAL_BATCHES = 50 // Safety limit: stop after 50 batches (handles up to 150 photos with batch size 3)
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 10000 // 10 seconds max
const REQUEST_TIMEOUT = 290000 // 290 seconds (slightly less than Vercel's 300s to allow cleanup)

export function QueueNotificationBanner({ pendingCount, processingCount }: QueueNotificationBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [batchCount, setBatchCount] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Don't show if no pending items or already dismissed
  if ((pendingCount === 0 && processingCount === 0) || isDismissed) {
    return null
  }

  const processQueue = async (isRetry = false, currentFailures = 0): Promise<void> => {
    const newBatchCount = batchCount + 1

    // Safety check: prevent infinite loops
    if (newBatchCount > MAX_TOTAL_BATCHES) {
      console.error(`[Queue Banner] Reached maximum batch limit (${MAX_TOTAL_BATCHES})`)
      toast.error("Processing Limit Reached", {
        description: `Processed ${totalProcessed} photos across ${batchCount} batches. Please restart processing for remaining photos.`,
        duration: 7000,
      })
      setIsProcessing(false)
      setTotalProcessed(0)
      setBatchCount(0)
      setConsecutiveFailures(0)
      return
    }

    // Check consecutive failures
    if (currentFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`[Queue Banner] Too many consecutive failures (${currentFailures})`)
      toast.error("Processing Stopped", {
        description: `Multiple failures detected. Processed ${totalProcessed} photos before stopping. Please check logs and try again.`,
        duration: 7000,
      })
      setIsProcessing(false)
      setTotalProcessed(0)
      setBatchCount(0)
      setConsecutiveFailures(0)
      return
    }

    try {
      // Create abort controller with timeout
      abortControllerRef.current = new AbortController()
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort()
      }, REQUEST_TIMEOUT)

      console.log(`[Queue Banner] Starting batch ${newBatchCount}...`)

      const response = await fetch('/api/photos/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      // Update progress
      const newTotalProcessed = totalProcessed + result.processed_count
      setTotalProcessed(newTotalProcessed)
      setBatchCount(newBatchCount)
      setConsecutiveFailures(0) // Reset on success

      console.log(`[Queue Banner] Batch ${newBatchCount} complete: ${result.processed_count} processed, ${result.remaining_count} remaining`)

      // Show progress toast
      if (result.has_more) {
        toast.info("Batch Complete - Continuing...", {
          description: `Processed ${newTotalProcessed} photos so far. ${result.remaining_count} remaining in queue. (Batch ${newBatchCount}/${MAX_TOTAL_BATCHES})`,
          duration: 3000,
        })

        // Calculate delay with exponential backoff (helps with rate limits)
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(1.5, Math.min(currentFailures, 3)),
          MAX_RETRY_DELAY
        )

        console.log(`[Queue Banner] Waiting ${delay}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, delay))

        // Continue processing
        await processQueue(true, 0) // Reset failures on successful batch
      } else {
        // All done!
        toast.success("Processing Complete!", {
          description: `Successfully processed ${newTotalProcessed} photo${newTotalProcessed !== 1 ? "s" : ""} across ${newBatchCount} batch${newBatchCount !== 1 ? "es" : ""}!`,
          duration: 5000,
        })

        // Reset states
        setIsProcessing(false)
        setTotalProcessed(0)
        setBatchCount(0)
        setConsecutiveFailures(0)

        // Refresh the page to update counts
        setTimeout(() => {
          router.refresh()
        }, 1000)
      }
    } catch (error) {
      // Check if it was aborted by user
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Queue Banner] Processing cancelled (user or timeout)')
        toast.warning("Processing Interrupted", {
          description: `Processed ${totalProcessed} photos before interruption. Click "Process Now" to continue.`,
          duration: 5000,
        })
        setIsProcessing(false)
        setTotalProcessed(0)
        setBatchCount(0)
        setConsecutiveFailures(0)
        return
      }

      // Handle error with retry logic
      const newFailures = currentFailures + 1
      setConsecutiveFailures(newFailures)

      console.error(`[Queue Banner] Batch ${newBatchCount} failed (attempt ${newFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error)

      if (newFailures < MAX_CONSECUTIVE_FAILURES) {
        // Retry with exponential backoff
        const retryDelay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, newFailures),
          MAX_RETRY_DELAY
        )

        toast.warning(`Batch Failed - Retrying in ${retryDelay / 1000}s...`, {
          description: `Error: ${error instanceof Error ? error.message : "Unknown error"}. Attempt ${newFailures}/${MAX_CONSECUTIVE_FAILURES}`,
          duration: 3000,
        })

        console.log(`[Queue Banner] Retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        await processQueue(true, newFailures)
      } else {
        // Max retries reached
        toast.error("Processing Failed", {
          description: `Failed after ${MAX_CONSECUTIVE_FAILURES} attempts. Processed ${totalProcessed} photos. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          duration: 7000,
        })

        setIsProcessing(false)
        setTotalProcessed(0)
        setBatchCount(0)
        setConsecutiveFailures(0)
      }
    }
  }

  const handleProcessNow = async () => {
    setIsProcessing(true)
    setTotalProcessed(0)
    setBatchCount(0)
    setConsecutiveFailures(0)

    toast.info("Processing Started", {
      description: "Processing photos in batches. This will continue automatically until all photos are processed. You can cancel anytime.",
      duration: 3000,
    })

    await processQueue(false, 0)
  }

  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsProcessing(false)
    setTotalProcessed(0)
    setBatchCount(0)
    setConsecutiveFailures(0)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  return (
    <Alert className="relative mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AlertDescription>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 mb-1">
                  {isProcessing ? (
                    <>Processing Photos (Batch {batchCount})...</>
                  ) : processingCount > 0 ? (
                    <>Processing Photos...</>
                  ) : (
                    <>Photos Ready for Processing</>
                  )}
                </p>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    {isProcessing && (
                      <>
                        Processed {totalProcessed} photo{totalProcessed !== 1 ? "s" : ""} so far.
                        Processing continues automatically in batches.
                      </>
                    )}
                    {!isProcessing && processingCount > 0 && (
                      <>
                        {processingCount} photo{processingCount !== 1 ? "s are" : " is"} currently being processed.
                        {pendingCount > 0 && ` ${pendingCount} more waiting in queue.`}
                      </>
                    )}
                    {!isProcessing && processingCount === 0 && pendingCount > 0 && (
                      <>
                        You have {pendingCount} photo{pendingCount !== 1 ? "s" : ""} waiting for AI processing
                        (captions, embeddings, face detection).
                      </>
                    )}
                  </p>
                  {isProcessing && (
                    <p className="text-xs text-blue-600 font-medium">
                      Auto-retry enabled: System will continue processing until all photos are complete. You can cancel anytime.
                    </p>
                  )}
                  {!isProcessing && processingCount > 0 && (
                    <p className="text-xs text-blue-600 font-medium">
                      AI is analyzing each photo to generate captions and enable smart search. This takes a while to ensure the best results!
                    </p>
                  )}
                  {!isProcessing && processingCount === 0 && pendingCount > 0 && (
                    <p className="text-xs text-blue-600 font-medium">
                      Processing enables AI-powered features like smart search and automatic photo organization. You can continue browsing while it runs in the background.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Button
              onClick={handleCancelProcessing}
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Cancel
            </Button>
          ) : pendingCount > 0 && processingCount === 0 && (
            <Button
              onClick={handleProcessNow}
              disabled={isProcessing}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Process Now
            </Button>
          )}
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
