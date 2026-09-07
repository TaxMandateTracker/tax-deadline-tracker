"use client"

import { useEffect, useState, useMemo } from "react"

interface TaxCalendarRow {
  CalendarID: number
  FYE: string
  TaxYear: number
  FormType: string
  EntityType: string
  Jurisdiction: string
  StateProvince: string | null
  HolidayLocation: string | null
  HolidayEligible: string
  DisasterName: string | null
  DisasterEligible: string
  DisasterLocation: string | null
  DisasterCounties: string | null
  DisasterDeadline: string | null
  OriginalDeadline: string | null
  ExtensionDeadline: string | null
  SourceType: string | null
  SourceURL: string | null
}

const JURISDICTION_COLORS: Record<string, string> = {
  US:     "bg-blue-100 text-blue-700",
  Canada: "bg-red-100 text-red-700",
}

const FORM_COLORS: Record<string, string> = {
  "1040":     "bg-purple-100 text-purple-700",
  "1120S":    "bg-green-100 text-green-700",
  "1065":     "bg-yellow-100 text-yellow-700",
  "1120":     "bg-orange-100 text-orange-700",
  "990":      "bg-pink-100 text-pink-700",
  "1041":     "bg-indigo-100 text-indigo-700",
  "W-2/1099": "bg-gray-100 text-gray-700",
  "T1":       "bg-red-100 text-red-700",
  "T2":       "bg-red-100 text-red-700",
  "T3":       "bg-red-100 text-red-700",
  "T4/T5":    "bg-red-100 text-red-700",
}

export default function TaxCalendarTable() {
  const [records, setRecords] = useState<TaxCalendarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runMessage, setRunMessage] = useState("")
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString())
  const [filterJurisdiction, setFilterJurisdiction] = useState("all")
  const [filterForm, setFilterForm] = useState("all")
  const [filterDisaster, setFilterDisaster] = useState("all")
  const [search, setSearch] = useState("")
  const [runYear, setRunYear] = useState(new Date().getFullYear().toString())
  const [showRunPanel, setShowRunPanel] = useState(false)

  useEffect(() => {
    fetchCalendar()
  }, [filterYear, filterJurisdiction, filterForm])

  async function fetchCalendar() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterYear)         params.set("taxYear", filterYear)
      if (filterJurisdiction !== "all") params.set("jurisdiction", filterJurisdiction)
      if (filterForm !== "all")         params.set("formType", filterForm)

      const res = await fetch(`/api/tax-calendar?${params.toString()}`)
      const data = await res.json()
      setRecords(data)
    } catch (error) {
      console.error("Failed to fetch tax calendar:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRunUpdate() {
    setRunning(true)
    setRunMessage("")
    try {
      const res = await fetch("/api/tax-calendar/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(runYear) }),
      })
      const data = await res.json()
      if (data.success) {
        setRunMessage(`✅ Update triggered for ${runYear}. Check back in 2-3 minutes.`)
      } else {
        setRunMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setRunMessage("❌ Failed to trigger update")
    } finally {
      setRunning(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  function isDueSoon(dateStr: string | null) {
    if (!dateStr) return false
    const due = new Date(dateStr)
    const now = new Date()
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30
  }

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterDisaster === "yes" && r.DisasterEligible !== "Yes") return false
      if (filterDisaster === "no"  && r.DisasterEligible !== "No")  return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.FormType?.toLowerCase().includes(q) ||
          r.EntityType?.toLowerCase().includes(q) ||
          r.Jurisdiction?.toLowerCase().includes(q) ||
          r.DisasterName?.toLowerCase().includes(q) ||
          r.DisasterLocation?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [records, filterDisaster, search])

  const uniqueForms = [...new Set(records.map(r => r.FormType))].sort()
  const uniqueYears = ["2024", "2025", "2026", "2027"]

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── TOOLBAR ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search */}
          <input
            type="text"
            placeholder="Search form, entity, disaster..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 w-52 focus:outline-none focus:border-orange-400"
          />

          {/* Tax Year */}
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400"
          >
            {uniqueYears.map(y => <option key={y}>{y}</option>)}
          </select>

          {/* Jurisdiction */}
          <select
            value={filterJurisdiction}
            onChange={e => setFilterJurisdiction(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400"
          >
            <option value="all">All jurisdictions</option>
            <option value="US">US only</option>
            <option value="Canada">Canada only</option>
          </select>

          {/* Form type */}
          <select
            value={filterForm}
            onChange={e => setFilterForm(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400"
          >
            <option value="all">All forms</option>
            {uniqueForms.map(f => <option key={f}>{f}</option>)}
          </select>

          {/* Disaster filter */}
          <select
            value={filterDisaster}
            onChange={e => setFilterDisaster(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400"
          >
            <option value="all">All records</option>
            <option value="yes">Disaster eligible only</option>
            <option value="no">No disaster</option>
          </select>

          {/* Row count */}
          <span className="text-xs text-gray-400">
            {filteredRecords.length} records
          </span>
        </div>

        {/* Run update button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRunPanel(!showRunPanel)}
            className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
          >
            🔄 Run Update
          </button>
        </div>
      </div>

      {/* ── RUN PANEL ── */}
      {showRunPanel && (
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-orange-700">
            Run tax calendar update for year:
          </span>
          <input
            type="number"
            value={runYear}
            onChange={e => setRunYear(e.target.value)}
            className="text-xs border border-orange-300 rounded px-2 py-1 w-20 focus:outline-none"
          />
          <button
            onClick={handleRunUpdate}
            disabled={running}
            className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {running ? "Triggering..." : "Run now"}
          </button>
          {runMessage && (
            <span className="text-xs text-orange-700 font-medium">
              {runMessage}
            </span>
          )}
          <span className="text-xs text-orange-500 ml-auto">
            Takes 1-10 minutes depending on year
          </span>
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Loading tax calendar...</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">FYE</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-16">Year</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Form</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-36">Entity type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Jurisdiction</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-32">Original deadline</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-32">Extension deadline</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-20">Holiday</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">Disaster</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-32">Disaster deadline</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">Location</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 w-20">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((row) => (
                <tr
                  key={row.CalendarID}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    row.DisasterEligible === "Yes" ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-gray-600">
                    {formatDate(row.FYE)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {row.TaxYear}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      FORM_COLORS[row.FormType] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {row.FormType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {row.EntityType}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      JURISDICTION_COLORS[row.Jurisdiction] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {row.Jurisdiction}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${
                      isOverdue(row.OriginalDeadline) ? "text-red-500" :
                      isDueSoon(row.OriginalDeadline) ? "text-orange-500" :
                      "text-gray-700"
                    }`}>
                      {formatDate(row.OriginalDeadline)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {formatDate(row.ExtensionDeadline)}
                  </td>
                  <td className="px-3 py-2">
                    {row.HolidayEligible === "Yes" ? (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        {row.HolidayLocation}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.DisasterEligible === "Yes" ? (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        {row.DisasterName}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.DisasterDeadline ? (
                      <span className="text-red-600 font-medium">
                        {formatDate(row.DisasterDeadline)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {row.DisasterLocation ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      row.SourceType === "HISTORICAL"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {row.SourceType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}