"use client"

import { createContext, useContext, useEffect, useState } from "react"

interface Permissions {
  canSeeFees: boolean
  canSeeEAC: boolean
  canSeeBillableRate: boolean
  canSeeCostRate: boolean
  canSeeProfitMargin: boolean
  canSeeStaffRates: boolean
  canSeeStaffSalaries: boolean
  canSeeClientFees: boolean
  canSeeAllStaff: boolean
  canSeeUtilization: boolean
  canExportData: boolean
  canSeeReports: boolean
}

interface CurrentUser {
  id: string | null
  fullName: string
  email: string | null
  position: string
  role: string
  team: string | null
  billableRate: number | null
  isOwner: boolean
  permissions: Permissions
}

interface UserContextType {
  currentUser: CurrentUser | null
  loading: boolean
  isPartner: boolean
  isITAdmin: boolean
  isManager: boolean
  isSenior: boolean
  isAssociate: boolean
  canSeeFinancials: boolean
  canSeeAllStaff: boolean
  canSeeAdminPortal: boolean
  permissions: Permissions
}

const DEFAULT_PERMISSIONS: Permissions = {
  canSeeFees: true,
  canSeeEAC: true,
  canSeeBillableRate: true,
  canSeeCostRate: true,
  canSeeProfitMargin: true,
  canSeeStaffRates: true,
  canSeeStaffSalaries: true,
  canSeeClientFees: true,
  canSeeAllStaff: true,
  canSeeUtilization: true,
  canExportData: true,
  canSeeReports: true,
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  loading: true,
  isPartner: false,
  isITAdmin: false,
  isManager: false,
  isSenior: false,
  isAssociate: false,
  canSeeFinancials: false,
  canSeeAllStaff: false,
  canSeeAdminPortal: false,
  permissions: DEFAULT_PERMISSIONS,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/me")
        const data = await res.json()
        setCurrentUser(data)
      } catch (error) {
        console.error("Failed to fetch user profile:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMe()
  }, [])

  const role = currentUser?.role ?? "Associate"

  const isPartner = role === "Partner" || currentUser?.isOwner === true
  const isITAdmin = role === "IT Admin"
  const isManager = role === "Manager"
  const isSenior = role === "Senior"
  const isAssociate = role === "Associate" || role === "Junior"

  const canSeeFinancials = isPartner || isITAdmin || isManager
  const canSeeAllStaff = isPartner || isITAdmin || isManager
  const canSeeAdminPortal = isPartner || isITAdmin

  const permissions = currentUser?.permissions ?? DEFAULT_PERMISSIONS

  return (
    <UserContext.Provider
      value={{
        currentUser,
        loading,
        isPartner,
        isITAdmin,
        isManager,
        isSenior,
        isAssociate,
        canSeeFinancials,
        canSeeAllStaff,
        canSeeAdminPortal,
        permissions,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}