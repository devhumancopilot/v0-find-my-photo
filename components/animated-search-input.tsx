"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

const PROMPTS = [
  "photos with just me and Dad over ten years",
  "siblings together this winter",
  "all the sunset photos from our beach trip",
  "pictures of grandma from the last five years",
  "family gatherings during the holidays",
  "my kids' first day of school photos",
]

export function AnimatedSearchInput() {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Blinking cursor effect
  useEffect(() => {
    if (userInput) {
      setShowCursor(false)
      return
    }

    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530)

    return () => clearInterval(cursorInterval)
  }, [userInput])

  // Typewriter animation
  useEffect(() => {
    if (userInput) return // Stop animation when user is typing

    const currentPrompt = PROMPTS[currentPromptIndex]
    const typingSpeed = isDeleting ? 30 : 80
    const pauseDuration = 2000

    const timeout = setTimeout(
      () => {
        if (!isDeleting && displayedText === currentPrompt) {
          // Finished typing, pause then start deleting
          setTimeout(() => setIsDeleting(true), pauseDuration)
        } else if (isDeleting && displayedText === "") {
          // Finished deleting, move to next prompt
          setIsDeleting(false)
          setCurrentPromptIndex((prev) => (prev + 1) % PROMPTS.length)
        } else if (isDeleting) {
          // Delete one character
          setDisplayedText(currentPrompt.substring(0, displayedText.length - 1))
        } else {
          // Type one character
          setDisplayedText(currentPrompt.substring(0, displayedText.length + 1))
        }
      },
      isDeleting && displayedText === "" ? 500 : typingSpeed,
    )

    return () => clearTimeout(timeout)
  }, [displayedText, isDeleting, currentPromptIndex, userInput])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/sign-up")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value)
  }

  const handleInputFocus = () => {
    if (!userInput) {
      setDisplayedText("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center overflow-hidden rounded-2xl border border-white/20 bg-white/60 shadow-2xl backdrop-blur-sm transition-all hover:shadow-3xl">
          <div className="flex items-center pl-6">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder=""
              className="w-full bg-transparent px-4 py-6 text-lg text-foreground outline-none placeholder:text-muted-foreground"
            />
            {!userInput && (
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                {displayedText}
                {showCursor && <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-foreground">|</span>}
              </div>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="m-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
          >
            Create Album
          </Button>
        </div>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Beautiful albums from $4.99 • No monthly subscriptions, ever
      </p>
    </div>
  )
}
