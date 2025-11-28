"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Loader2, Bug, Upload as UploadIcon, X, FileImage } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  google_photos_connected: boolean
  google_photos_connected_at: string | null
  created_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Form states
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  // Email change states
  const [newEmail, setNewEmail] = useState("")
  const [changingEmail, setChangingEmail] = useState(false)

  // Bug report states
  const [bugTitle, setBugTitle] = useState("")
  const [bugDescription, setBugDescription] = useState("")
  const [bugType, setBugType] = useState("bug")
  const [severity, setSeverity] = useState("medium")
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([])
  const [submittingBug, setSubmittingBug] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/sign-in")
        return
      }

      setEmail(user.email || "")

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) throw error

      setProfile(data)
      setDisplayName(data.display_name || "")
      setBio(data.bio || "")
    } catch (error) {
      console.error("Error loading profile:", error)
      setMessage({ type: "error", text: "Failed to load profile" })
    } finally {
      setLoading(false)
    }
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          bio: bio,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)

      if (error) throw error

      setMessage({ type: "success", text: "Profile updated successfully" })
      await loadProfile()
    } catch (error) {
      console.error("Error updating profile:", error)
      setMessage({ type: "error", text: "Failed to update profile" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnectGoogle() {
    if (!confirm("Are you sure you want to disconnect Google Photos?")) return

    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("profiles")
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
          google_photos_connected: false,
          google_photos_connected_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)

      if (error) throw error

      setMessage({ type: "success", text: "Google Photos disconnected" })
      await loadProfile()
    } catch (error) {
      console.error("Error disconnecting Google Photos:", error)
      setMessage({ type: "error", text: "Failed to disconnect Google Photos" })
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setChangingPassword(true)
    setMessage(null)

    try {
      // Validate passwords
      if (newPassword !== confirmPassword) {
        setMessage({ type: "error", text: "New passwords do not match" })
        return
      }

      if (newPassword.length < 6) {
        setMessage({ type: "error", text: "Password must be at least 6 characters" })
        return
      }

      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({ type: "success", text: "Password updated successfully" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      console.error("Error changing password:", error)
      setMessage({ type: "error", text: error.message || "Failed to change password" })
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setChangingEmail(true)
    setMessage(null)

    try {
      if (!newEmail || !newEmail.includes("@")) {
        setMessage({ type: "error", text: "Please enter a valid email address" })
        return
      }

      // Update email using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (error) throw error

      setMessage({
        type: "success",
        text: "Confirmation email sent. Please check your inbox to verify the new email address."
      })
      setNewEmail("")
    } catch (error: any) {
      console.error("Error changing email:", error)
      setMessage({ type: "error", text: error.message || "Failed to change email" })
    } finally {
      setChangingEmail(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])

    // Limit to 5 screenshots
    if (screenshots.length + files.length > 5) {
      setMessage({ type: "error", text: "Maximum 5 screenshots allowed" })
      return
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith("image/")) {
        setMessage({ type: "error", text: `${file.name} is not an image` })
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage({ type: "error", text: `${file.name} is too large (max 5MB)` })
        return false
      }
      return true
    })

    setScreenshots([...screenshots, ...validFiles])

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setScreenshotPreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  function removeScreenshot(index: number) {
    setScreenshots(screenshots.filter((_, i) => i !== index))
    setScreenshotPreviews(screenshotPreviews.filter((_, i) => i !== index))
  }

  async function handleBugReportSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingBug(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Upload screenshots if any
      const screenshotUrls: string[] = []

      for (const file of screenshots) {
        const fileExt = file.name.split(".").pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("bug-screenshots")
          .upload(fileName, file)

        if (uploadError) {
          console.error("Error uploading screenshot:", uploadError)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from("bug-screenshots")
          .getPublicUrl(fileName)

        screenshotUrls.push(publicUrl)
      }

      // Get browser info
      const browserInfo = `${navigator.userAgent}`

      // Submit bug report
      const authHeaders = await getAuthHeaders()
      const response = await fetch(getBackendAPIURL("/api/bug-reports"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          title: bugTitle,
          description: bugDescription,
          bug_type: bugType,
          severity,
          page_url: window.location.href,
          browser_info: browserInfo,
          screenshot_urls: screenshotUrls
        })
      })

      if (!response.ok) {
        throw new Error("Failed to submit bug report")
      }

      setMessage({
        type: "success",
        text: "Bug report submitted successfully! Thank you for helping us improve."
      })

      // Reset form
      setBugTitle("")
      setBugDescription("")
      setBugType("bug")
      setSeverity("medium")
      setScreenshots([])
      setScreenshotPreviews([])

    } catch (error: any) {
      console.error("Error submitting bug report:", error)
      setMessage({
        type: "error",
        text: error.message || "Failed to submit bug report. Please try again."
      })
    } finally {
      setSubmittingBug(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your profile, preferences, and connected services
          </p>
        </div>

        {message && (
          <Alert className={`mb-6 ${message.type === "error" ? "border-red-500" : "border-green-500"}`}>
            {message.type === "error" ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <AlertDescription className={message.type === "error" ? "text-red-700" : "text-green-700"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="services">Connected Services</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="bug-report">
              <Bug className="mr-2 h-4 w-4" />
              Report a Bug
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {/* Basic Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your public profile details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {displayName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Profile Picture</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Avatar from your connected Google account
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us a bit about yourself"
                      rows={4}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Profile
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Email Management */}
            <Card>
              <CardHeader>
                <CardTitle>Email Address</CardTitle>
                <CardDescription>
                  Change your account email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentEmail">Current Email</Label>
                    <Input
                      id="currentEmail"
                      type="email"
                      value={email}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newEmail">New Email Address</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                    />
                    <p className="text-xs text-gray-500">
                      A confirmation link will be sent to your new email address
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={changingEmail || !newEmail}>
                      {changingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Change Email
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Password Management */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    <p className="text-xs text-gray-500">
                      Password must be at least 6 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={changingPassword || !newPassword || !confirmPassword}
                    >
                      {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Change Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>Connected Services</CardTitle>
                <CardDescription>
                  Manage your connected accounts and integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold">
                      G
                    </div>
                    <div>
                      <p className="font-medium">Google Photos</p>
                      <p className="text-sm text-gray-500">
                        {profile?.google_photos_connected
                          ? `Connected ${profile.google_photos_connected_at ? new Date(profile.google_photos_connected_at).toLocaleDateString() : ""}`
                          : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {profile?.google_photos_connected ? (
                      <>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Connected
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectGoogle}
                          disabled={saving}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                </div>

                {process.env.NEXT_PUBLIC_ENABLE_FACE_DETECTION === "true" && (
                  <Alert>
                    <AlertDescription>
                      Face detection is enabled for your account. Manage face profiles from the dashboard.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your account preferences and security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input value={email} disabled />
                  <p className="text-xs text-gray-500">
                    Your email address is managed by your authentication provider
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Account Created</Label>
                  <Input
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ""}
                    disabled
                  />
                </div>

                <div className="pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Sign Out</p>
                      <p className="text-sm text-gray-500">Sign out of your account</p>
                    </div>
                    <Button variant="outline" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-medium text-red-900 mb-2">Delete Account</p>
                    <p className="text-sm text-red-700 mb-4">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button variant="destructive" size="sm" disabled>
                      Delete Account (Coming Soon)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bug-report">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Report a Bug or Issue
                </CardTitle>
                <CardDescription>
                  Help us improve by reporting bugs, errors, or suggesting features. Your feedback is valuable!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBugReportSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="bugTitle">Title <span className="text-red-500">*</span></Label>
                    <Input
                      id="bugTitle"
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      placeholder="Brief summary of the issue"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bugType">Type <span className="text-red-500">*</span></Label>
                    <select
                      id="bugType"
                      value={bugType}
                      onChange={(e) => setBugType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="bug">Bug / Error</option>
                      <option value="ui_issue">UI Issue</option>
                      <option value="performance">Performance Problem</option>
                      <option value="feature_request">Feature Request</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="severity">Severity <span className="text-red-500">*</span></Label>
                    <select
                      id="severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="low">Low - Minor inconvenience</option>
                      <option value="medium">Medium - Affects functionality</option>
                      <option value="high">High - Major issue</option>
                      <option value="critical">Critical - App unusable</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bugDescription">Description <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="bugDescription"
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      placeholder="Please describe the issue in detail. Include:&#10;- What you were doing when it happened&#10;- What you expected to happen&#10;- What actually happened&#10;- Steps to reproduce the issue"
                      rows={8}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="screenshots">Screenshots (Optional)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileImage className="h-8 w-8 text-gray-400" />
                        <div className="text-center">
                          <label
                            htmlFor="screenshots"
                            className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Click to upload screenshots
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG up to 5MB each (max 5 files)
                          </p>
                        </div>
                        <input
                          id="screenshots"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleScreenshotSelect}
                          className="hidden"
                        />
                      </div>

                      {screenshotPreviews.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                          {screenshotPreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`Screenshot ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              <button
                                type="button"
                                onClick={() => removeScreenshot(index)}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-800 text-sm">
                      Your report will include your browser information and the current page URL to help us diagnose the issue.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setBugTitle("")
                        setBugDescription("")
                        setBugType("bug")
                        setSeverity("medium")
                        setScreenshots([])
                        setScreenshotPreviews([])
                      }}
                      disabled={submittingBug}
                    >
                      Clear Form
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingBug || !bugTitle || !bugDescription}
                    >
                      {submittingBug && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Report
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
