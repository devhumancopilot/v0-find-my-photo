import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Mail } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-semibold text-foreground">Find My Photo</span>
        </Link>

        <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>We've sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Thank you for signing up! Please check your email and click the confirmation link to activate your
              account.
            </p>
            <div className="rounded-lg bg-primary/10 p-4 text-sm">
              <p className="font-medium text-primary">What's next?</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>1. Check your inbox for the confirmation email</li>
                <li>2. Click the confirmation link</li>
                <li>3. Sign in to start creating albums</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <Link href="/sign-in">Go to Sign In</Link>
              </Button>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
