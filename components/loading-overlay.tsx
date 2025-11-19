"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
}

export function LoadingOverlay({ isLoading, message = "Loading..." }: LoadingOverlayProps) {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isLoading) {
      // Small delay before showing to avoid flash for fast navigations
      const showTimer = setTimeout(() => setShow(true), 100)

      // Failsafe: automatically hide after 5 seconds to prevent stuck state
      const hideTimer = setTimeout(() => setShow(false), 5000)

      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    } else {
      setShow(false)
    }
  }, [isLoading])

  if (!mounted || !show) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-3 rounded-lg bg-white px-6 py-5 shadow-xl animate-in zoom-in-95 duration-150">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-gray-200 border-t-blue-600" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>,
    document.body
  )
}
