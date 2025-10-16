import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Heart, Clock, Zap } from "lucide-react"
import { AnimatedSearchInput } from "@/components/animated-search-input"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/40 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">Find My Photo</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-balance text-5xl font-bold leading-tight text-foreground md:text-6xl">
            Turn Your Memories Into Beautiful Photo Albums
          </h1>
          <p className="mb-12 text-pretty text-xl text-muted-foreground">
            Let AI help you discover the perfect photos from your collection. Create stunning albums in minutes, not
            hours.
          </p>

          <AnimatedSearchInput />
        </div>

        {/* Hero Image Placeholder */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/40 p-2 shadow-2xl backdrop-blur-sm">
            <img
              src="/modern-photo-album-dashboard-with-grid-of-beautifu.jpg"
              alt="Find My Photo Dashboard"
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">Why You'll Love Find My Photo</h2>
          <p className="text-pretty text-lg text-muted-foreground">
            Creating photo albums has never been easier or more delightful
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-white/20 bg-white/60 p-6 backdrop-blur-sm transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">AI-Powered Discovery</h3>
            <p className="text-pretty text-muted-foreground">
              Describe what you're looking for, and our AI finds the perfect photos from your collection automatically.
            </p>
          </Card>

          <Card className="border-white/20 bg-white/60 p-6 backdrop-blur-sm transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">Save Hours of Time</h3>
            <p className="text-pretty text-muted-foreground">
              No more scrolling through thousands of photos. Create beautiful albums in minutes instead of hours.
            </p>
          </Card>

          <Card className="border-white/20 bg-white/60 p-6 backdrop-blur-sm transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-red-600">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">Preserve What Matters</h3>
            <p className="text-pretty text-muted-foreground">
              Your memories deserve to be celebrated. Create albums that tell your story beautifully.
            </p>
          </Card>

          <Card className="border-white/20 bg-white/60 p-6 backdrop-blur-sm transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">Lightning Fast</h3>
            <p className="text-pretty text-muted-foreground">
              Our AI processes your photos instantly, so you can start creating albums right away.
            </p>
          </Card>

          <Card className="border-white/20 bg-white/60 p-6 backdrop-blur-sm transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">Multiple Sources</h3>
            <p className="text-pretty text-muted-foreground">
              Connect Google Photos, iCloud, or upload directly. All your photos in one place.
            </p>
          </Card>

          <Card className="border-white/20 bg-white/60 p-6 backdrop-blur-sm transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">Private & Secure</h3>
            <p className="text-pretty text-muted-foreground">
              Your photos are yours. We never share or sell your data. Period.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-balance text-4xl font-bold text-foreground">How It Works</h2>
          <p className="text-pretty text-lg text-muted-foreground">Three simple steps to your perfect photo album</p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Connect Your Photos</h3>
              <p className="text-pretty text-muted-foreground">
                Link your Google Photos, iCloud, or upload photos directly
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-2xl font-bold text-white">
                2
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Describe Your Album</h3>
              <p className="text-pretty text-muted-foreground">Tell our AI what kind of album you want to create</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-red-600 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Review & Refine</h3>
              <p className="text-pretty text-muted-foreground">AI suggests photos, you approve and customize</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/20 bg-gradient-to-br from-blue-500 to-purple-600 p-12 text-center shadow-2xl">
          <h2 className="mb-4 text-balance text-4xl font-bold text-white">Ready to Create Your First Album?</h2>
          <p className="mb-8 text-pretty text-xl text-white/90">
            Join thousands of people who are preserving their memories with Find My Photo
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-white text-purple-600 hover:bg-white/90">
              <Sparkles className="mr-2 h-5 w-5" />
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/20 bg-white/40 backdrop-blur-md">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">Find My Photo</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2025 Find My Photo. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
