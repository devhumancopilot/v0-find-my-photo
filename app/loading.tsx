/**
 * Global Loading Component
 * Shows during Next.js page transitions and server wake-up (Render cold starts)
 */

import { Sparkles } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Loading Animation */}
        <div className="mb-4 flex justify-center space-x-2">
          <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]"></div>
          <div className="h-3 w-3 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.15s]"></div>
          <div className="h-3 w-3 animate-bounce rounded-full bg-pink-500"></div>
        </div>

        {/* Loading Text */}
        <h2 className="mb-2 text-xl font-semibold text-gray-800">Loading Find My Photo</h2>
        <p className="text-sm text-gray-600">
          Preparing your photo library...
        </p>

        {/* Cold Start Message (only on Render free tier) */}
        {process.env.NODE_ENV === 'production' && (
          <p className="mt-4 text-xs text-gray-500">
            First load may take a moment while the server wakes up
          </p>
        )}
      </div>
    </div>
  )
}
