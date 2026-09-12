"use client"

import { useEffect, useState } from "react"

interface Staff {
  StaffID: number
  FirstName: string
  LastName: string
  Email: string
  Role: string
  Team: string | null
  UnitsSunday: number
  UnitsMonday: number
  UnitsTuesday: number
  UnitsWednesday: number
  UnitsThursday: number
  UnitsFriday: number
  UnitsSaturday: number
  IsActive: boolean
}

interface Partner {
  PartnerID: number
  StaffID: number
  PartnerName: string
  Email: string
  IsActive: boolean
}

interface Manager {
  ManagerID: number
  StaffID: number
  ManagerName: string
  Email: string
  IsActive: boolean
}

const ROLES = ["Partner", "IT Admin", "Manager", "Senior", "Associate", "Junior"]

export default function StaffManagement() {
  const [staff, setStaff]           = useState<Staff[]>([])
  const [partners, setPartners]     = useState<Partner[]>([])
  const [managers, setManagers]     = useState<Manager[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<"staff" | "partners" | "managers">("staff")
  const [search, setSearch]         = useState("")
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [message, setMessage]       = useState("")

  // Add staff form
  const [newFirstName, setNewFirstName]         = useState("")
  const [newLastName, setNewLastName]           = useState("")
  const [newEmail, setNewEmail]                 = useState("")
  const [newRole, setNewRole]                   = useState("Associate")
  const [newTeam, setNewTeam]                   = useState("")
  const [newUnitsSunday, setNewUnitsSunday]     = useState(0)
  const [newUnitsMonday, setNewUnitsMonday]     = useState(8)
  const [newUnitsTuesday, setNewUnitsTuesday]   = useState(8)
  const [newUnitsWednesday, setNewUnitsWednesday] = useState(8)
  const [newUnitsThursday, setNewUnitsThursday] = useState(8)
  const [newUnitsFriday, setNewUnitsFriday]     = useState(8)
  const [newUnitsSaturday, setNewUnitsSaturday] = useState(0)
  const [newIsActive, setNewIsActive]           = useState(true)

  // Promote modal
  const [promoteStaff, setPromoteStaff] = useState<Staff | null>(null)
  const [promoteTo, setPromoteTo]       = useState<"partner" | "manager" | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [staffRes, partnersRes, managersRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/partners"),
        fetch("/api/managers"),
      ])
      if (staffRes.ok)    setStaff(await staffRes.json())
      if (partnersRes.ok) setPartners(await partnersRes.json())
      if (managersRes.ok) setManagers(await managersRes.json())
    } catch (error) {
      console.error("Failed to fetch:", error)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setNewFirstName("")
    setNewLastName("")
    setNewEmail("")
    setNewRole("Associate")
    setNewTeam("")
    setNewUnitsSunday(0)
    setNewUnitsMonday(8)
    setNewUnitsTuesday(8)
    setNewUnitsWednesday(8)
    setNewUnitsThursday(8)
    setNewUnitsFriday(8)
    setNewUnitsSaturday(0)
    setNewIsActive(true)
  }

  async function handleAddStaff() {
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/staff", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          FirstName:      newFirstName,
          LastName:       newLastName,
          Email:          newEmail,
          Role:           newRole,
          Team:           newTeam || null,
          UnitsSunday:    newUnitsSunday,
          UnitsMonday:    newUnitsMonday,
          UnitsTuesday:   newUnitsTuesday,
          UnitsWednesday: newUnitsWednesday,
          UnitsThursday:  newUnitsThursday,
          UnitsFriday:    newUnitsFriday,
          UnitsSaturday:  newUnitsSaturday,
          IsActive:       newIsActive,
        }),
      })
      if (res.ok) {
        setMessage("✅ Staff member added successfully")
        setShowAddStaff(false)
        resetForm()
        fetchAll()
        setTimeout(() => setMessage(""), 3000)
      } else {
        const err = await res.json()
        setMessage(`❌ ${err.error}`)
      }
    } catch (error) {
      setMessage(`❌ Failed to add staff: ${error}`)
    } finally {
      setSaving(false)
    }
  }

  async function handlePromote() {
    if (!promoteStaff || !promoteTo) return
    setSaving(true)
    try {
      const endpoint = promoteTo === "partner" ? "/api/partners" : "/api/managers"
      const body     = promoteTo === "partner"
        ? {
            StaffID:     promoteStaff.StaffID,
            PartnerName: `${promoteStaff.FirstName} ${promoteStaff.LastName}`,
            Email:       promoteStaff.Email,
          }
        : {
            StaffID:     promoteStaff.StaffID,
            ManagerName: `${promoteStaff.FirstName} ${promoteStaff.LastName}`,
            Email:       promoteStaff.Email,
          }

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })

      if (res.ok) {
        setMessage(`✅ ${promoteStaff.FirstName} ${promoteStaff.LastName} promoted to ${promoteTo}`)
        setPromoteStaff(null)
        setPromoteTo(null)
        fetchAll()
        setTimeout(() => setMessage(""), 3000)
      } else {
        const err = await res.json()
        setMessage(`❌ ${err.error}`)
      }
    } catch (error) {
      setMessage(`❌ Failed to promote: ${error}`)
    } finally {
      setSaving(false)
    }
  }

  const filteredStaff = staff.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.FirstName.toLowerCase().includes(q) ||
      s.LastName.toLowerCase().includes(q) ||
      s.Email.toLowerCase().includes(q) ||
      s.Role.toLowerCase().includes(q)
    )
  })

  function getInitials(first: string, last: string) {
    return `${first[0]}${last[0]}`.toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading staff...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Sub tabs */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-1">
          {[
            { key: "staff",    label: `Staff (${staff.length})` },
            { key: "partners", label: `Partners (${partners.length})` },
            { key: "managers", label: `Managers (${managers.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {message && (
            <span className={`text-xs ${
              message.startsWith("✅") ? "text-green-600" : "text-red-500"
            }`}>
              {message}
            </span>
          )}
          {activeTab === "staff" && (
            <button
              onClick={() => setShowAddStaff(true)}
              className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
            >
              + Add staff
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-2 border-b border-gray-200 bg-white">
        <input
          type="text"
          placeholder="Search by name, email or role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 w-64 focus:outline-none focus:border-orange-400"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">

        {/* ── STAFF TAB ── */}
        {activeTab === "staff" && (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Role</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Team</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Sun</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Mon</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Tue</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Wed</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Thu</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Fri</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-12">Sat</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Active</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Partner</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Manager</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-gray-400">
                    No staff found — click + Add staff to add your first staff member
                  </td>
                </tr>
              ) : (
                filteredStaff.map(s => {
                  const isPartner = partners.some(p => p.StaffID === s.StaffID)
                  const isManager = managers.some(m => m.StaffID === s.StaffID)
                  return (
                    <tr key={s.StaffID} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-medium text-orange-700 flex-shrink-0">
                            {getInitials(s.FirstName, s.LastName)}
                          </div>
                          <span className="font-medium text-gray-800">
                            {s.FirstName} {s.LastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{s.Email}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          s.Role === "Partner"  ? "bg-purple-100 text-purple-700" :
                          s.Role === "IT Admin" ? "bg-red-100 text-red-700" :
                          s.Role === "Manager"  ? "bg-blue-100 text-blue-700" :
                          s.Role === "Senior"   ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {s.Role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{s.Team ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsSunday}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsMonday}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsTuesday}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsWednesday}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsThursday}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsFriday}</td>
                      <td className="px-3 py-2 text-gray-500 text-center">{s.UnitsSaturday}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          s.IsActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {s.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                                            <td className="px-3 py-2">
                        {isPartner ? (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            P-{partners.find(p => p.StaffID === s.StaffID)?.PartnerID}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {isManager ? (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            M-{managers.find(m => m.StaffID === s.StaffID)?.ManagerID}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {!isPartner && (
                            <button
                              onClick={() => { setPromoteStaff(s); setPromoteTo("partner") }}
                              className="text-[10px] border border-purple-200 text-purple-600 px-2 py-0.5 rounded hover:bg-purple-50"
                            >
                              → Partner
                            </button>
                          )}
                          {!isManager && (
                            <button
                              onClick={() => { setPromoteStaff(s); setPromoteTo("manager") }}
                              className="text-[10px] border border-blue-200 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                            >
                              → Manager
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}

        {/* ── PARTNERS TAB ── */}
        {activeTab === "partners" && (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <th className="text-left px-4 py-2 font-medium text-gray-500">Partner Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Staff ID</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Active</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                    No partners yet — promote a staff member from the Staff tab
                  </td>
                </tr>
              ) : (
                partners.filter(p => {
                  if (!search) return true
                  const q = search.toLowerCase()
                  return p.PartnerName.toLowerCase().includes(q) || p.Email.toLowerCase().includes(q)
                }).map(p => (
                  <tr key={p.PartnerID} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-medium text-purple-700">
                          {p.PartnerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="font-medium text-gray-800">{p.PartnerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{p.Email}</td>
                    <td className="px-4 py-2 text-gray-500">{p.StaffID}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.IsActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {p.IsActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* ── MANAGERS TAB ── */}
        {activeTab === "managers" && (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <th className="text-left px-4 py-2 font-medium text-gray-500">Manager Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Staff ID</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Active</th>
              </tr>
            </thead>
            <tbody>
              {managers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                    No managers yet — promote a staff member from the Staff tab
                  </td>
                </tr>
              ) : (
                managers.filter(m => {
                  if (!search) return true
                  const q = search.toLowerCase()
                  return m.ManagerName.toLowerCase().includes(q) || m.Email.toLowerCase().includes(q)
                }).map(m => (
                  <tr key={m.ManagerID} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700">
                          {m.ManagerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="font-medium text-gray-800">{m.ManagerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{m.Email}</td>
                    <td className="px-4 py-2 text-gray-500">{m.StaffID}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        m.IsActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {m.IsActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ADD STAFF MODAL ── */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-[520px] shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Staff Member</h3>
            <div className="grid grid-cols-2 gap-3">

              <div>
                <label className="text-xs text-gray-500 block mb-1">First Name *</label>
                <input
                  type="text"
                  value={newFirstName}
                  onChange={e => setNewFirstName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Last Name *</label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={e => setNewLastName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Team</label>
                <input
                  type="text"
                  value={newTeam}
                  onChange={e => setNewTeam(e.target.value)}
                  placeholder="e.g. Tax, Audit"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Working hours */}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-2">Daily Working Hours</label>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { label: "Sun", value: newUnitsSunday,    set: setNewUnitsSunday },
                    { label: "Mon", value: newUnitsMonday,    set: setNewUnitsMonday },
                    { label: "Tue", value: newUnitsTuesday,   set: setNewUnitsTuesday },
                    { label: "Wed", value: newUnitsWednesday, set: setNewUnitsWednesday },
                    { label: "Thu", value: newUnitsThursday,  set: setNewUnitsThursday },
                    { label: "Fri", value: newUnitsFriday,    set: setNewUnitsFriday },
                    { label: "Sat", value: newUnitsSaturday,  set: setNewUnitsSaturday },
                  ].map(day => (
                    <div key={day.label} className="text-center">
                      <p className="text-[10px] text-gray-400 mb-1">{day.label}</p>
                      <input
                        type="number"
                        value={day.value}
                        onChange={e => day.set(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={12}
                        step={0.5}
                        className="w-full text-xs border border-gray-200 rounded px-1 py-1.5 text-center focus:outline-none focus:border-orange-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsActive}
                    onChange={e => setNewIsActive(e.target.checked)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-600">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddStaff}
                disabled={saving || !newFirstName.trim() || !newLastName.trim() || !newEmail.trim()}
                className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add staff"}
              </button>
              <button
                onClick={() => { setShowAddStaff(false); resetForm() }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROMOTE MODAL ── */}
      {promoteStaff && promoteTo && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Promote to {promoteTo === "partner" ? "Partner" : "Manager"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {promoteStaff.FirstName} {promoteStaff.LastName} will be added to
              {promoteTo === "partner" ? " TblPartner" : " TblManager"} and can be
              assigned to mandates as a {promoteTo}.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-medium text-orange-700">
                  {getInitials(promoteStaff.FirstName, promoteStaff.LastName)}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">
                    {promoteStaff.FirstName} {promoteStaff.LastName}
                  </p>
                  <p className="text-[10px] text-gray-400">{promoteStaff.Email}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePromote}
                disabled={saving}
                className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Promoting..." : `Promote to ${promoteTo}`}
              </button>
              <button
                onClick={() => { setPromoteStaff(null); setPromoteTo(null) }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}