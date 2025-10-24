"use client"

import { signOut } from "@/app/actions/auth"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LogOut } from "lucide-react"
import { useState } from "react"

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await signOut()
    } catch (error) {
      console.error("Logout failed:", error)
      setIsLoggingOut(false)
      alert("Failed to log out. Please try again.")
    }
  }

  return (
    <DropdownMenuItem
      className="text-destructive cursor-pointer"
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isLoggingOut ? "Logging out..." : "Log out"}
    </DropdownMenuItem>
  )
}
