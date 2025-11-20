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

export function QueueNotificationBanner({ pendingCount, processingCount }: QueueNotificationBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [batchCount, setBatchCount] = useState(0)
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Don't show if no pending items or already dismissed
  if ((pendingCount === 0 && processingCount === 0) || isDismissed) {
    return null
  }

  const processQueue = async (isRetry = false): Promise<void> => {
    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/photos/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to start processing')
      }

      const result = await response.json()

      // Update progress
      const newTotalProcessed = totalProcessed + result.processed_count
      const newBatchCount = batchCount + 1
      setTotalProcessed(newTotalProcessed)
      setBatchCount(newBatchCount)

      console.log(`[Queue Banner] Batch ${newBatchCount} complete: ${result.processed_count} processed, ${result.remaining_count} remaining`)

      // Show progress toast
      if (result.has_more) {
        toast.info("Batch Complete - Continuing...", {
          description: `Processed ${newTotalProcessed} photos so far. ${result.remaining_count} remaining in queue.`,
          duration: 3000,
        })

        // Automatically retry if there are more items
        // Small delay to avoid hammering the server
        await new Promise(resolve => setTimeout(resolve, 1000))
        await processQueue(true)
      } else {
        // All done!
        toast.success("Processing Complete!", {
          description: `Successfully processed ${newTotalProcessed} photo${newTotalProcessed !== 1 ? "s" : ""} across ${newBatchCount} batch${newBatchCount !== 1 ? "es" : ""}.`,
          duration: 5000,
        })

        // Reset states
        setIsProcessing(false)
        setTotalProcessed(0)
        setBatchCount(0)

        // Refresh the page to update counts
        setTimeout(() => {
          router.refresh()
        }, 1000)
      }
    } catch (error) {
      // Check if it was aborted by user
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Queue Banner] Processing cancelled by user')
        toast.info("Processing Cancelled", {
          description: `Processed ${totalProcessed} photos before cancellation.`,
          duration: 3000,
        })
      } else {
        console.error("Processing error:", error)
        toast.error("Processing Failed", {
          description: error instanceof Error ? error.message : "Failed to process queue. Please try again.",
          duration: 5000,
        })
      }

      setIsProcessing(false)
      setTotalProcessed(0)
      setBatchCount(0)
    }
  }

  const handleProcessNow = async () => {
    setIsProcessing(true)
    setTotalProcessed(0)
    setBatchCount(0)

    toast.info("Processing Started", {
      description: "Processing photos in batches. This will continue automatically until all photos are processed.",
      duration: 3000,
    })

    await processQueue(false)
  }

  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsProcessing(false)
    setTotalProcessed(0)
    setBatchCount(0)
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
