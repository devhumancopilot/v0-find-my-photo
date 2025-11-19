"use client"

import { useState } from "react"
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
  const router = useRouter()

  // Don't show if no pending items or already dismissed
  if ((pendingCount === 0 && processingCount === 0) || isDismissed) {
    return null
  }

  const handleProcessNow = async () => {
    setIsProcessing(true)

    try {
      const response = await fetch('/api/photos/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to start processing')
      }

      const result = await response.json()

      const processedCount = result.processed_count || 0
      const failedCount = result.failed_count || 0
      const remaining = result.remaining || 0

      if (failedCount > 0) {
        toast.warning("Processing Completed with Errors", {
          description: `Processed ${processedCount} photo${processedCount !== 1 ? "s" : ""}. ${failedCount} failed. ${remaining > 0 ? `${remaining} remaining.` : ''}`,
          duration: 5000,
        })
      } else {
        toast.success("Processing Completed!", {
          description: `Successfully processed ${processedCount} photo${processedCount !== 1 ? "s" : ""}. ${remaining > 0 ? `${remaining} remaining - click again to continue.` : 'All done!'}`,
          duration: 5000,
        })
      }

      // Refresh the page to update counts
      setTimeout(() => {
        router.refresh()
        // If there are remaining photos, keep the processing state ready
        if (remaining === 0) {
          setIsProcessing(false)
        }
      }, 1000)
    } catch (error) {
      console.error("Processing error:", error)
      toast.error("Processing Failed", {
        description: error instanceof Error ? error.message : "Failed to start processing. Please try again.",
        duration: 5000,
      })
      setIsProcessing(false)
    }
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
                  {processingCount > 0 ? (
                    <>Processing Photos...</>
                  ) : (
                    <>Photos Ready for Processing</>
                  )}
                </p>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    {processingCount > 0 && (
                      <>
                        {processingCount} photo{processingCount !== 1 ? "s are" : " is"} currently being processed.
                        {pendingCount > 0 && ` ${pendingCount} more waiting in queue.`}
                      </>
                    )}
                    {processingCount === 0 && pendingCount > 0 && (
                      <>
                        You have {pendingCount} photo{pendingCount !== 1 ? "s" : ""} waiting for AI processing
                        (captions, embeddings, face detection).
                      </>
                    )}
                  </p>
                  {processingCount > 0 && (
                    <p className="text-xs text-blue-600 font-medium">
                      AI is analyzing each photo to generate captions and enable smart search. This takes a while to ensure the best results!
                    </p>
                  )}
                  {processingCount === 0 && pendingCount > 0 && (
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
          {pendingCount > 0 && (
            <Button
              onClick={handleProcessNow}
              disabled={isProcessing}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isProcessing ? "Starting..." : processingCount > 0 ? `Process ${pendingCount} Pending` : "Process Now"}
            </Button>
          )}
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  )
}
