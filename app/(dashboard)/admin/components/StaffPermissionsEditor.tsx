"use client"

import { useEffect, useState } from "react"

interface Staff {
  id: string
  fullName: string
  email: string
  role: string
  position: string
  team: string
  isActive: boolean
  billableRate: number | null
  costRate: number | null
  resourceId: string | null
}

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

const PERMISSION_GROUPS = [
  {
    group: "Financial Columns",
    permissions: [
      { key: "canSeeFees", label: "Fees & Revenue" },
      { key: "canSeeEAC", label: "Estimate at Completion (EAC)" },
      { key: "canSeeBillableRate", label: "Billable rates" },
      { key: "canSeeCostRate", label: "Cost rates" },
      { key: "canSeeProfitMargin", label: "Profit margins" },
    ],
  },
  {
    group: "Staff Columns",
    permissions: [
      { key: "canSeeStaffRates", label: "Staff billable rates" },
      { key: "canSeeStaffSalaries", label: "Staff salaries / cost rates" },
      { key: "canSeeAllStaff", label: "All staff members" },
      { key: "canSeeUtilization", label: "Utilization percentages" },
    ],
  },
  {
    group: "Client Columns",
    permissions: [
      { key: "canSeeClientFees", label: "Client fees" },
    ],
  },
  {
    group: "Reports & Exports",
    permissions: [
      { key: "canSeeReports", label: "Reports screen" },
      { key: "canExportData", label: "Export data to CSV" },
    ],
  },
]

const ROLE_COLORS: Record<string, string> = {
  Partner: "bg-purple-100 text-purple-700",
  "IT Admin": "bg-red-100 text-red-700",
  Manager: "bg-blue-100 text-blue-700",
  Senior: "bg-green-100 text-green-700",
  Associate: "bg-gray-100 text-gray-600",
  Junior: "bg-gray-100 text-gray-500",
}

const ROLES = ["Partner", "IT Admin", "Manager", "Senior", "Associate", "Junior"]
const POSITIONS = ["Partner", "Manager", "Senior", "Associate", "Junior"]
const TEAMS = ["Tax", "Audit", "Advisory", "Accounting", "Consulting", "IT"]

export default function StaffPermissionsEditor() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<"profile" | "permissions">("profile")

  // Profile edit state
  const [editRole, setEditRole] = useState("")
  const [editPosition, setEditPosition] = useState("")
  const [editTeam, setEditTeam] = useState("")
  const [editIsActive, setEditIsActive] = useState(true)
  const [editBillableRate, setEditBillableRate] = useState("")
  const [editCostRate, setEditCostRate] = useState("")

  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch("/api/staff")
        const data = await res.json()
        setStaffList(data)
        if (data.length > 0) {
          await selectStaff(data[0])
        }
      } catch (error) {
        console.error("Failed to fetch staff:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStaff()
  }, [])

  async function selectStaff(staff: Staff) {
    setSelectedStaff(staff)
    setPermissions(null)
    setSaved(false)
    setSavedProfile(false)
    setEditRole(staff.role)
    setEditPosition(staff.position)
    setEditTeam(staff.team)
    setEditIsActive(staff.isActive)
    setEditBillableRate(staff.billableRate?.toString() ?? "")
    setEditCostRate(staff.costRate?.toString() ?? "")

    try {
      const res = await fetch(`/api/permissions/${staff.id}`)
      const data = await res.json()
      setPermissions(data)
    } catch (error) {
      console.error("Failed to fetch permissions:", error)
    }
  }

  function togglePermission(key: string) {
    if (!permissions) return
    setPermissions((prev) => ({
      ...prev!,
      [key]: !prev![key as keyof Permissions],
    }))
    setSaved(false)
  }

  async function handleSavePermissions() {
    if (!selectedStaff || !permissions) return
    setSaving(true)
    try {
      await fetch(`/api/permissions/${selectedStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      })
      setSaved(true)
    } catch (error) {
      console.error("Failed to save permissions:", error)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProfile() {
    if (!selectedStaff) return
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/staff/${selectedStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          position: editPosition,
          team: editTeam,
          isActive: editIsActive,
          billableRate: editBillableRate ? parseFloat(editBillableRate) : null,
          costRate: editCostRate ? parseFloat(editCostRate) : null,
        }),
      })
      const updated = await res.json()

      // Update staff list with new data
      setStaffList((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )
      setSelectedStaff(updated)
      setSavedProfile(true)
    } catch (error) {
      console.error("Failed to save profile:", error)
    } finally {
      setSavingProfile(false)
    }
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading staff...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">

      {/* Staff list sidebar */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">Staff Members</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Click a staff member to manage
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {staffList.map((staff) => (
            <button
              key={staff.id}
              onClick={() => selectStaff(staff)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedStaff?.id === staff.id
                  ? "bg-orange-50 border-l-2 border-l-orange-500"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                  staff.isActive
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {getInitials(staff.fullName)}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium truncate ${
                    staff.isActive ? "text-gray-800" : "text-gray-400 line-through"
                  }`}>
                    {staff.fullName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      ROLE_COLORS[staff.role] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {staff.role}
                    </span>
                    {!staff.isActive && (
                      <span className="text-[10px] text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedStaff ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">Select a staff member</p>
          </div>
        ) : (
          <>
            {/* Staff header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  selectedStaff.isActive
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {getInitials(selectedStaff.fullName)}
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-900">
                    {selectedStaff.fullName}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedStaff.email}
                  </p>
                </div>
              </div>

              {/* Active/Inactive badge */}
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                selectedStaff.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {selectedStaff.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white px-6">
              <button
                onClick={() => setActiveTab("profile")}
                className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
                  activeTab === "profile"
                    ? "border-orange-500 text-orange-500 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Profile & Role
              </button>
              <button
                onClick={() => setActiveTab("permissions")}
                className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
                  activeTab === "permissions"
                    ? "border-orange-500 text-orange-500 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Column Permissions
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-6">

              {/* Profile tab */}
              {activeTab === "profile" && (
                <div className="max-w-2xl flex flex-col gap-4">

                  {/* Status toggle */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-800">
                          Staff status
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Inactive staff cannot log in or be assigned tasks
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditIsActive(!editIsActive)
                          setSavedProfile(false)
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          editIsActive ? "bg-orange-500" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            editIsActive ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs mt-2 font-medium">
                      {editIsActive ? (
                        <span className="text-green-600">● Active</span>
                      ) : (
                        <span className="text-red-500">● Inactive</span>
                      )}
                    </p>
                  </div>

                  {/* Role and position */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-800 mb-4">
                      Role & Position
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          System role
                          <span className="text-gray-300 ml-1">(controls access)</span>
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => {
                            setEditRole(e.target.value)
                            setSavedProfile(false)
                          }}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                        >
                          {ROLES.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Job title
                          <span className="text-gray-300 ml-1">(displayed on board)</span>
                        </label>
                        <select
                          value={editPosition}
                          onChange={(e) => {
                            setEditPosition(e.target.value)
                            setSavedProfile(false)
                          }}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                        >
                          {POSITIONS.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Team / Practice group
                        </label>
                        <select
                          value={editTeam}
                          onChange={(e) => {
                            setEditTeam(e.target.value)
                            setSavedProfile(false)
                          }}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                        >
                          {TEAMS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Rates */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-800 mb-4">
                      Billing rates
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Billable rate ($/h)
                        </label>
                        <input
                          type="number"
                          value={editBillableRate}
                          onChange={(e) => {
                            setEditBillableRate(e.target.value)
                            setSavedProfile(false)
                          }}
                          placeholder="e.g. 200"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Cost rate ($/h)
                        </label>
                        <input
                          type="number"
                          value={editCostRate}
                          onChange={(e) => {
                            setEditCostRate(e.target.value)
                            setSavedProfile(false)
                          }}
                          placeholder="e.g. 100"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="bg-orange-500 text-white text-sm px-6 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                      {savingProfile ? "Saving..." : "Save profile"}
                    </button>
                    {savedProfile && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Profile saved
                      </span>
                    )}
                  </div>

                  {/* Warning for role change */}
                  {editRole !== selectedStaff.role && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-700 font-medium">
                        ⚠ Role change notice
                      </p>
                      <p className="text-xs text-yellow-600 mt-0.5">
                        Changing role from <strong>{selectedStaff.role}</strong> to{" "}
                        <strong>{editRole}</strong> will take effect the next time{" "}
                        {selectedStaff.fullName} signs in.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Permissions tab */}
              {activeTab === "permissions" && (
                <div className="max-w-2xl flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Control which columns {selectedStaff.fullName} can see
                    </p>
                    <div className="flex items-center gap-3">
                      {saved && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Saved
                        </span>
                      )}
                      <button
                        onClick={handleSavePermissions}
                        disabled={saving}
                        className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save permissions"}
                      </button>
                    </div>
                  </div>

                  {!permissions ? (
                    <p className="text-sm text-gray-400">Loading permissions...</p>
                  ) : (
                    <>
                      {PERMISSION_GROUPS.map((group) => (
                        <div
                          key={group.group}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              {group.group}
                            </h3>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {group.permissions.map((perm) => (
                              <div
                                key={perm.key}
                                className="flex items-center justify-between px-4 py-3"
                              >
                                <label
                                  htmlFor={perm.key}
                                  className="text-sm text-gray-700 cursor-pointer"
                                >
                                  {perm.label}
                                </label>
                                <button
                                  id={perm.key}
                                  onClick={() => togglePermission(perm.key)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                    permissions[perm.key as keyof Permissions]
                                      ? "bg-orange-500"
                                      : "bg-gray-200"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                      permissions[perm.key as keyof Permissions]
                                        ? "translate-x-4"
                                        : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Quick presets */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Quick presets
                          </h3>
                        </div>
                        <div className="p-4 flex gap-3 flex-wrap">
                          <button
                            onClick={() => setPermissions({
                              canSeeFees: true, canSeeEAC: true,
                              canSeeBillableRate: true, canSeeCostRate: true,
                              canSeeProfitMargin: true, canSeeStaffRates: true,
                              canSeeStaffSalaries: true, canSeeClientFees: true,
                              canSeeAllStaff: true, canSeeUtilization: true,
                              canExportData: true, canSeeReports: true,
                            })}
                            className="text-xs border border-purple-200 text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100"
                          >
                            Full access (Partner)
                          </button>
                          <button
                            onClick={() => setPermissions({
                              canSeeFees: false, canSeeEAC: false,
                              canSeeBillableRate: false, canSeeCostRate: false,
                              canSeeProfitMargin: false, canSeeStaffRates: false,
                              canSeeStaffSalaries: false, canSeeClientFees: false,
                              canSeeAllStaff: true, canSeeUtilization: true,
                              canExportData: true, canSeeReports: true,
                            })}
                            className="text-xs border border-red-200 text-red-700 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                          >
                            IT Admin (no financials)
                          </button>
                          <button
                            onClick={() => setPermissions({
                              canSeeFees: true, canSeeEAC: true,
                              canSeeBillableRate: true, canSeeCostRate: false,
                              canSeeProfitMargin: true, canSeeStaffRates: true,
                              canSeeStaffSalaries: false, canSeeClientFees: true,
                              canSeeAllStaff: true, canSeeUtilization: true,
                              canExportData: true, canSeeReports: true,
                            })}
                            className="text-xs border border-blue-200 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                          >
                            Manager preset
                          </button>
                          <button
                            onClick={() => setPermissions({
                              canSeeFees: false, canSeeEAC: false,
                              canSeeBillableRate: false, canSeeCostRate: false,
                              canSeeProfitMargin: false, canSeeStaffRates: false,
                              canSeeStaffSalaries: false, canSeeClientFees: false,
                              canSeeAllStaff: false, canSeeUtilization: false,
                              canExportData: false, canSeeReports: false,
                            })}
                            className="text-xs border border-gray-200 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                          >
                            Minimal (Associate)
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}