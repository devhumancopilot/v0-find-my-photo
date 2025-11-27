/**
 * Interactive Progress Loader for Photo Search
 * Shows real-time progress with educational messages during vision reasoning
 */

"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

export interface SearchProgress {
  stage:
    | "start"
    | "embedding"
    | "search"
    | "filtering"
    | "enhancing"
    | "vision_start"
    | "vision_batch"
    | "vision_filtering"
    | "vision_reranking"
    | "verification"
    | "complete"
  message: string
  educational?: string
  current?: number
  total?: number
  percentage?: number
}

interface SearchProgressLoaderProps {
  progress: SearchProgress
  className?: string
}

export function SearchProgressLoader({ progress, className }: SearchProgressLoaderProps) {
  const [dots, setDots] = useState("")

  // Animated dots for loading state
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Calculate progress percentage
  const percentage =
    progress.percentage ??
    (progress.current && progress.total ? Math.round((progress.current / progress.total) * 100) : undefined)

  return (
    <div className={`space-y-4 p-6 rounded-lg border bg-card ${className || ""}`}>
      {/* Main progress message */}
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <p className="font-medium text-sm">
            {progress.message}
            {!percentage && dots}
          </p>
          {progress.educational && (
            <p className="text-xs text-muted-foreground mt-1">
              💡 {progress.educational}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar (if applicable) */}
      {percentage !== undefined && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress.current} of {progress.total}
            </span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Stage indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex gap-1">
          {["start", "embedding", "search", "filtering", "enhancing", "vision_start", "verification", "complete"].map(
            (stage, idx) => (
              <div
                key={stage}
                className={`w-2 h-2 rounded-full transition-colors ${
                  getStageOrder(progress.stage) >= idx ? "bg-primary" : "bg-secondary"
                }`}
              />
            )
          )}
        </div>
        <span className="ml-2">{getStageLabel(progress.stage)}</span>
      </div>
    </div>
  )
}

function getStageOrder(stage: SearchProgress["stage"]): number {
  const order: Record<SearchProgress["stage"], number> = {
    start: 0,
    embedding: 1,
    search: 2,
    filtering: 3,
    enhancing: 4,
    vision_start: 5,
    vision_batch: 5,
    vision_filtering: 5,
    vision_reranking: 5,
    verification: 6,
    complete: 7,
  }
  return order[stage] || 0
}

function getStageLabel(stage: SearchProgress["stage"]): string {
  const labels: Record<SearchProgress["stage"], string> = {
    start: "Initializing",
    embedding: "Generating Embeddings",
    search: "Searching Library",
    filtering: "Filtering Results",
    enhancing: "Enhancing Ranking",
    vision_start: "Vision Validation",
    vision_batch: "Vision Validation",
    vision_filtering: "Vision Filtering",
    vision_reranking: "Vision Re-ranking",
    verification: "Verifying Ownership",
    complete: "Complete",
  }
  return labels[stage] || stage
}
