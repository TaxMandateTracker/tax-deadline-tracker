"use client"

import { useUser } from "@/lib/context/UserContext"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import StaffPermissionsEditor from "./components/StaffPermissionsEditor"
import StaffManagement from "./components/StaffManagement"

export default function AdminPage() {
  const { canSeeAdminPortal, loading } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("staff-management")

  useEffect(() => {
    if (!loading && !canSeeAdminPortal) {
      router.push("/mandates")
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
          Manage staff, partners, managers and permissions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {[
          { key: "staff-management", label: "Staff Management" },
          { key: "permissions",      label: "Staff Permissions" },
          { key: "firm-settings",    label: "Firm Settings" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-orange-500 text-orange-500 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "staff-management" && <StaffManagement />}
        {activeTab === "permissions"      && <StaffPermissionsEditor />}
        {activeTab === "firm-settings"    && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Firm settings coming soon</p>
          </div>
        )}
      </div>
    </div>
  )
}