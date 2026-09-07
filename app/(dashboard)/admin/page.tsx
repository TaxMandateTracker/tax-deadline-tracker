"use client"

import { useUser } from "@/lib/context/UserContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import StaffPermissionsEditor from "./components/StaffPermissionsEditor"

export default function AdminPage() {
  const { canSeeAdminPortal, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !canSeeAdminPortal) {
      router.push("/planning")
    }
  }, [loading, canSeeAdminPortal, router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[calc(100vh-48px)]">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!canSeeAdminPortal) {
    return null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-sm font-medium text-gray-900">Admin Portal</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Manage staff permissions and column-level access control
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        <button className="text-sm px-4 py-2.5 border-b-2 border-orange-500 text-orange-500 font-medium">
          Staff Permissions
        </button>
        <button className="text-sm px-4 py-2.5 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Firm Settings
        </button>
        <button className="text-sm px-4 py-2.5 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          Activity Logs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <StaffPermissionsEditor />
      </div>
    </div>
  )
}