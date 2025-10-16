"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Sparkles, Upload, Cloud, ImageIcon, ArrowRight, ArrowLeft } from "lucide-react"

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const totalSteps = 3
  const progress = (currentStep / totalSteps) * 100

  const handleSourceToggle = (source: string) => {
    setSelectedSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]))
  }

  const handleNext = async () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step)
    } else {
      setIsLoading(true)
      try {
        const response = await fetch("/api/webhooks/onboarding-completed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedSources }),
        })

        if (!response.ok) {
          throw new Error("Failed to complete onboarding")
        }

        router.push("/dashboard")
      } catch (error) {
        console.error("[v0] Onboarding completion error:", error)
        // Still redirect to dashboard even if webhook fails
        router.push("/dashboard")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step)
    }
  }

  const canProceed = currentStep === 2 ? selectedSources.length > 0 : true

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/40 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">Find My Photo</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Skip</Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step 1: Welcome */}
          {currentStep === 1 && (
            <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-3xl">Welcome to Find My Photo</CardTitle>
                <CardDescription className="text-base">
                  Let's get you set up in just a few steps. We'll help you connect your photos and create your first
                  album.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Connect Your Photos</h3>
                      <p className="text-sm text-muted-foreground">
                        Link your Google Photos, iCloud, or upload directly
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">AI Discovers Your Photos</h3>
                      <p className="text-sm text-muted-foreground">
                        Our AI analyzes your collection to help you find the perfect shots
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Create Beautiful Albums</h3>
                      <p className="text-sm text-muted-foreground">Build stunning photo albums in minutes, not hours</p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleNext}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Connect Photo Sources */}
          {currentStep === 2 && (
            <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Connect Your Photos</CardTitle>
                <CardDescription className="text-base">
                  Choose where you'd like to import photos from. You can add more sources later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Google Photos */}
                  <button
                    onClick={() => handleSourceToggle("google")}
                    className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all hover:shadow-md ${
                      selectedSources.includes("google") ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600">
                      <Cloud className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground">Google Photos</h3>
                      <p className="text-xs text-muted-foreground">Connect your Google account</p>
                    </div>
                    {selectedSources.includes("google") && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* iCloud */}
                  <button
                    onClick={() => handleSourceToggle("icloud")}
                    className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all hover:shadow-md ${
                      selectedSources.includes("icloud") ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600">
                      <Cloud className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground">iCloud Photos</h3>
                      <p className="text-xs text-muted-foreground">Connect your Apple account</p>
                    </div>
                    {selectedSources.includes("icloud") && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* Direct Upload */}
                  <button
                    onClick={() => handleSourceToggle("upload")}
                    className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all hover:shadow-md ${
                      selectedSources.includes("upload") ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-pink-600">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground">Direct Upload</h3>
                      <p className="text-xs text-muted-foreground">Upload from your device</p>
                    </div>
                    {selectedSources.includes("upload") && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>

                {selectedSources.length > 0 && (
                  <div className="rounded-lg bg-primary/10 p-4 text-sm text-primary">
                    <p className="font-medium">
                      {selectedSources.length} source{selectedSources.length > 1 ? "s" : ""} selected
                    </p>
                    <p className="text-xs">You can add or remove sources anytime from your settings</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleBack} variant="outline" className="w-full bg-transparent">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: All Set */}
          {currentStep === 3 && (
            <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                  <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <CardTitle className="text-3xl">You're All Set!</CardTitle>
                <CardDescription className="text-base">
                  Your account is ready. Let's create your first photo album.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-lg bg-primary/5 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <ImageIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Photos Connected</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedSources.length} source{selectedSources.length > 1 ? "s" : ""} ready to use
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-lg bg-primary/5 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">AI Ready</h3>
                      <p className="text-sm text-muted-foreground">Our AI is ready to help you discover photos</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 font-semibold text-foreground">Quick Tip</h3>
                  <p className="text-sm text-muted-foreground">
                    Try describing what you're looking for in natural language. For example: "Photos from my beach
                    vacation last summer" or "Pictures of my dog playing in the park"
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleBack} variant="outline" className="w-full bg-transparent" disabled={isLoading}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    disabled={isLoading}
                  >
                    {isLoading ? "Completing..." : "Go to Dashboard"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
