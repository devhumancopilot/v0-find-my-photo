/**
 * React hook for consuming Server-Sent Events (SSE) photo search stream
 * Provides real-time progress updates during long-running vision reasoning
 */

"use client"

import { useState, useCallback, useRef } from "react"
import type { SearchProgress } from "@/components/search-progress-loader"

export interface SearchResult {
  success: boolean
  searchType: "text" | "image"
  photos: any[]
  count: number
}

export interface UseSearchStreamReturn {
  isSearching: boolean
  progress: SearchProgress | null
  result: SearchResult | null
  error: string | null
  startSearch: (params: { query?: string; image?: string; albumTitle?: string }) => Promise<void>
  cancelSearch: () => void
}

export function useSearchStream(): UseSearchStreamReturn {
  const [isSearching, setIsSearching] = useState(false)
  const [progress, setProgress] = useState<SearchProgress | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const startSearch = useCallback(
    async (params: { query?: string; image?: string; albumTitle?: string }) => {
      // Reset state
      setIsSearching(true)
      setProgress(null)
      setResult(null)
      setError(null)

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch("/api/webhooks/album-create-request-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Check if response is SSE
        const contentType = response.headers.get("content-type")
        if (!contentType?.includes("text/event-stream")) {
          throw new Error("Expected SSE stream but got: " + contentType)
        }

        // Read SSE stream
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error("No readable stream available")
        }

        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || "" // Keep incomplete message in buffer

          for (const line of lines) {
            if (!line.trim()) continue

            // Parse SSE message
            const eventMatch = line.match(/^event: (.+)$/m)
            const dataMatch = line.match(/^data: (.+)$/m)

            if (eventMatch && dataMatch) {
              const event = eventMatch[1]
              const data = JSON.parse(dataMatch[1])

              console.log("[SearchStream] Event:", event, data)

              switch (event) {
                case "start":
                  setProgress({
                    stage: "start",
                    message: data.message,
                  })
                  break

                case "progress":
                  setProgress({
                    stage: data.stage,
                    message: data.message,
                    educational: data.educational,
                  })
                  break

                case "vision_progress":
                  setProgress({
                    stage: "vision_batch",
                    message: data.message,
                    educational: data.educational,
                    current: data.current,
                    total: data.total,
                  })
                  break

                case "complete":
                  setResult({
                    success: data.success,
                    searchType: data.searchType,
                    photos: data.photos,
                    count: data.count,
                  })
                  setProgress({
                    stage: "complete",
                    message: `Found ${data.count} matching photos!`,
                  })
                  setIsSearching(false)
                  break

                case "error":
                  setError(data.error || "Unknown error occurred")
                  setIsSearching(false)
                  break

                default:
                  console.warn("[SearchStream] Unknown event:", event)
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            console.log("[SearchStream] Search cancelled by user")
            setError("Search cancelled")
          } else {
            console.error("[SearchStream] Error:", err)
            setError(err.message)
          }
        } else {
          setError("Unknown error occurred")
        }
        setIsSearching(false)
      }
    },
    []
  )

  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsSearching(false)
    setProgress(null)
  }, [])

  return {
    isSearching,
    progress,
    result,
    error,
    startSearch,
    cancelSearch,
  }
}
