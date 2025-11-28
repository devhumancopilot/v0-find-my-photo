"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getBackendAPIURL } from "@/lib/config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, UserCircle, Edit2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FaceProfile {
  face_name: string
  face_count: number
  face_ids: number[]
  sample_photo_url: string | null
  latest_detection: string
}

interface FaceProfilesData {
  unknown_faces: FaceProfile
  named_faces: FaceProfile[]
  total_faces: number
  total_people: number
}

export function FaceProfilesSection() {
  const [data, setData] = useState<FaceProfilesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<FaceProfile | null>(null)
  const [newName, setNewName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchFaceProfiles()
  }, [])

  const fetchFaceProfiles = async () => {
    try {
      setLoading(true)
      const response = await fetch(getBackendAPIURL("/api/face-profiles"), {
        credentials: "include"
      })
      if (!response.ok) {
        throw new Error("Failed to fetch face profiles")
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load face profiles")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!selectedProfile || !newName.trim()) return

    try {
      setIsUpdating(true)
      const response = await fetch(getBackendAPIURL("/api/face-profiles/bulk-update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          face_ids: selectedProfile.face_ids,
          face_name: newName.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update face name")
      }

      // Refresh data
      await fetchFaceProfiles()
      setSelectedProfile(null)
      setNewName("")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update name")
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.total_faces === 0) {
    return (
      <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">No faces detected yet</h3>
          <p className="text-sm text-muted-foreground">
            Upload photos with people to automatically detect and organize faces
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stats Card */}
        <Card className="border-white/20 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Face Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-3xl font-bold">{data.total_people}</p>
                <p className="text-sm text-white/90">People identified</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{data.total_faces}</p>
                <p className="text-xs text-white/80">Total faces detected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Named People */}
        {data.named_faces.slice(0, 3).map((profile) => (
          <Card
            key={profile.face_name}
            className="group cursor-pointer border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg"
            onClick={() => {
              setSelectedProfile(profile)
              setNewName(profile.face_name)
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profile.sample_photo_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                    {profile.face_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{profile.face_name}</CardTitle>
                  <CardDescription className="text-xs">
                    {profile.face_count} {profile.face_count === 1 ? "photo" : "photos"}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedProfile(profile)
                    setNewName(profile.face_name)
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}

        {/* Unknown Faces Card */}
        {data.unknown_faces && data.unknown_faces.face_count > 0 && (
          <Card
            className="group cursor-pointer border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg"
            onClick={() => {
              setSelectedProfile(data.unknown_faces)
              setNewName("")
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-500 text-white">
                    <UserCircle className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">Unknown</CardTitle>
                  <CardDescription className="text-xs">
                    {data.unknown_faces.face_count} {data.unknown_faces.face_count === 1 ? "face" : "faces"} to identify
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedProfile(data.unknown_faces)
                    setNewName("")
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={(open) => !open && setSelectedProfile(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedProfile?.face_name === "unknown" ? "Name This Person" : "Update Name"}
            </DialogTitle>
            <DialogDescription>
              {selectedProfile && (
                <>
                  This will update {selectedProfile.face_count} {selectedProfile.face_count === 1 ? "photo" : "photos"}{" "}
                  with this face.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter person's name"
                disabled={isUpdating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProfile(null)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateName} disabled={!newName.trim() || isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
