import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, AlertCircle } from "lucide-react"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>
}) {
  const params = await searchParams

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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {params?.error ? (
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Error: {params.error}</p>
                {params.error_description && <p className="mt-1 text-xs text-red-600">{params.error_description}</p>}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                An unexpected error occurred during authentication. Please try again.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <Link href="/sign-in">Try Again</Link>
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
