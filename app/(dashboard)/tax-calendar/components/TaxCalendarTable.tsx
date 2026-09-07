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

type SortField = keyof TaxCalendarRow
type SortDir = "asc" | "desc"

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
  "941 Q1":   "bg-cyan-100 text-cyan-700",
  "941 Q2":   "bg-cyan-100 text-cyan-700",
  "941 Q3":   "bg-cyan-100 text-cyan-700",
  "941 Q4":   "bg-cyan-100 text-cyan-700",
  "T1":       "bg-red-100 text-red-700",
  "T2":       "bg-red-100 text-red-700",
  "T3":       "bg-red-100 text-red-700",
  "T4/T5":    "bg-red-100 text-red-700",
  "T3010":    "bg-red-100 text-red-700",
  "GST/HST":  "bg-red-100 text-red-700",
}

const COLUMNS: { key: SortField; label: string; width: string }[] = [
  { key: "FYE",               label: "FYE",                width: "w-28" },
  { key: "TaxYear",           label: "Tax Year",           width: "w-20" },
  { key: "FormType",          label: "Form",               width: "w-24" },
  { key: "EntityType",        label: "Entity Type",        width: "w-36" },
  { key: "Jurisdiction",      label: "Jurisdiction",       width: "w-24" },
  { key: "StateProvince",     label: "State/Province",     width: "w-28" },
  { key: "OriginalDeadline",  label: "Original Deadline",  width: "w-32" },
  { key: "ExtensionDeadline", label: "Extension Deadline", width: "w-32" },
  { key: "HolidayEligible",   label: "Holiday Eligible",   width: "w-28" },
  { key: "HolidayLocation",   label: "Holiday Location",   width: "w-36" },
  { key: "DisasterEligible",  label: "Disaster Eligible",  width: "w-28" },
  { key: "DisasterName",      label: "Disaster Name",      width: "w-36" },
  { key: "DisasterLocation",  label: "Disaster Location",  width: "w-28" },
  { key: "DisasterCounties",  label: "Disaster Counties",  width: "w-48" },
  { key: "DisasterDeadline",  label: "Disaster Deadline",  width: "w-32" },
  { key: "SourceType",        label: "Source Type",        width: "w-24" },
  { key: "SourceURL",         label: "Source URL",         width: "w-48" },
]

export default function TaxCalendarTable() {
  const [records, setRecords] = useState<TaxCalendarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runMessage, setRunMessage] = useState("")
  const [filterJurisdiction, setFilterJurisdiction] = useState("all")
  const [filterForm, setFilterForm] = useState("all")
  const [filterDisaster, setFilterDisaster] = useState("all")
  const [search, setSearch] = useState("")
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [sortField, setSortField] = useState<SortField>("OriginalDeadline")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [workflowStatus, setWorkflowStatus] = useState<"idle" | "queued" | "in_progress" | "completed" | "failed"> ("idle")
  const [statusInterval, setStatusInterval] = useState<NodeJS.Timeout | null>(null)

  const currentYear = new Date().getFullYear()
  const uniqueYears = Array.from(
    { length: 5 },
    (_, i) => (currentYear - 2 + i).toString()
  )
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString())
  const [runYear, setRunYear] = useState(currentYear.toString())

  async function fetchCalendar() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterYear)                   params.set("taxYear", filterYear)
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

  useEffect(() => {
    fetchCalendar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterJurisdiction, filterForm])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (statusInterval) clearInterval(statusInterval)
    }
  }, [statusInterval])

  function startPolling() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/tax-calendar/status")
        const data = await res.json()

        if (data.status === "in_progress" || data.status === "queued") {
          setWorkflowStatus("in_progress")
        } else if (data.status === "completed") {
          if (data.conclusion === "success") {
            setWorkflowStatus("completed")
            setRunMessage(`Update complete for ${runYear}`)
          } else {
            setWorkflowStatus("failed")
            setRunMessage(`Update failed — check GitHub Actions`)
          }
          clearInterval(interval)
          setStatusInterval(null)
        }
      } catch {
        console.error("Failed to check status")
      }
    }, 10000)

    setStatusInterval(interval)
  }

  async function handleRunUpdate() {
    setRunning(true)
    setRunMessage("")
    setWorkflowStatus("idle")
    try {
      const res = await fetch("/api/tax-calendar/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(runYear) }),
      })
      const data = await res.json()
      if (data.success) {
        setRunMessage(`Update triggered for ${runYear}`)
        setWorkflowStatus("queued")
        startPolling()
      } else {
        setRunMessage(`❌ Error: ${data.error}`)
        setWorkflowStatus("failed")
      }
    } catch {
      setRunMessage("❌ Failed to trigger update")
      setWorkflowStatus("failed")
    } finally {
      setRunning(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate()
    ).toLocaleDateString("en-US", {
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

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  function getSortIcon(field: SortField) {
    if (sortField !== field) return " ↕"
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const uniqueForms = [...new Set(records.map(r => r.FormType))].sort()

  const filteredAndSorted = useMemo(() => {
    let filtered = records.filter(r => {
      if (filterDisaster === "yes" && r.DisasterEligible !== "Yes") return false
      if (filterDisaster === "no"  && r.DisasterEligible !== "No")  return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.FormType?.toLowerCase().includes(q) ||
          r.EntityType?.toLowerCase().includes(q) ||
          r.Jurisdiction?.toLowerCase().includes(q) ||
          r.DisasterName?.toLowerCase().includes(q) ||
          r.DisasterLocation?.toLowerCase().includes(q) ||
          r.StateProvince?.toLowerCase().includes(q) ||
          r.HolidayLocation?.toLowerCase().includes(q) ||
          r.DisasterCounties?.toLowerCase().includes(q)
        )
      }
      return true
    })

    filtered.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      let compare = 0
      if (typeof aVal === "number" && typeof bVal === "number") {
        compare = aVal - bVal
      } else {
        compare = String(aVal).localeCompare(String(bVal))
      }
      return sortDir === "asc" ? compare : -compare
    })

    return filtered
  }, [records, filterDisaster, search, sortField, sortDir])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── TOOLBAR ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search */}
          <input
            type="text"
            placeholder="Search form, entity, disaster, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 w-64 focus:outline-none focus:border-orange-400"
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
            {filteredAndSorted.length} of {records.length} records
          </span>
        </div>

        {/* Run update button */}
        <button
          onClick={() => setShowRunPanel(!showRunPanel)}
          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
        >
          🔄 Run Update
        </button>
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
            disabled={running || workflowStatus === "in_progress" || workflowStatus === "queued"}
            className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {running ? "Triggering..." : "Run now"}
          </button>
          <span className="text-xs text-orange-500 ml-auto">
            Takes 1-10 minutes depending on year
          </span>
        </div>
      )}

      {/* ── STATUS BANNER ── */}
      {workflowStatus !== "idle" && (
        <div className={`px-4 py-2 border-b flex items-center gap-3 ${
          workflowStatus === "completed" ? "bg-green-50 border-green-200" :
          workflowStatus === "failed"    ? "bg-red-50 border-red-200" :
          "bg-blue-50 border-blue-200"
        }`}>
          {(workflowStatus === "queued" || workflowStatus === "in_progress") && (
            <div className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              <span className="text-xs text-blue-700 font-medium">
                {workflowStatus === "queued"
                  ? "Update queued — starting shortly..."
                  : "Update running — fetching IRS and CRA data..."}
              </span>
              <span className="text-xs text-blue-500 animate-pulse">
                This may take 1-10 minutes
              </span>
            </div>
          )}

          {workflowStatus === "completed" && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-green-700 font-medium">
                ✅ {runMessage}
              </span>
              <button
                onClick={() => {
                  fetchCalendar()
                  setWorkflowStatus("idle")
                }}
                className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              >
                🔄 Refresh data
              </button>
            </div>
          )}

          {workflowStatus === "failed" && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-red-700 font-medium">
                ❌ {runMessage}
              </span>
              <button
                onClick={() => setWorkflowStatus("idle")}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-orange-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              <p className="text-sm text-gray-400">Loading tax calendar...</p>
            </div>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-gray-400">No records found</p>
              <p className="text-xs text-gray-300 mt-1">
                Try running the update for this year
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs" style={{ minWidth: "2400px" }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`text-left px-3 py-2 font-medium text-gray-500 cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none ${col.width}`}
                  >
                    {col.label}
                    <span className="text-gray-300 text-[10px]">
                      {getSortIcon(col.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((row) => (
                <tr
                  key={row.CalendarID}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    row.DisasterEligible === "Yes" ? "bg-red-50/20" : ""
                  }`}
                >
                  {/* FYE */}
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {formatDate(row.FYE)}
                  </td>

                  {/* TaxYear */}
                  <td className="px-3 py-2 text-gray-600">
                    {row.TaxYear}
                  </td>

                  {/* FormType */}
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      FORM_COLORS[row.FormType] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {row.FormType}
                    </span>
                  </td>

                  {/* EntityType */}
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {row.EntityType}
                  </td>

                  {/* Jurisdiction */}
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      JURISDICTION_COLORS[row.Jurisdiction] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {row.Jurisdiction}
                    </span>
                  </td>

                  {/* StateProvince */}
                  <td className="px-3 py-2 text-gray-500">
                    {row.StateProvince ?? "—"}
                  </td>

                  {/* OriginalDeadline */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`font-medium ${
                      isOverdue(row.OriginalDeadline) ? "text-red-500" :
                      isDueSoon(row.OriginalDeadline) ? "text-orange-500" :
                      "text-gray-700"
                    }`}>
                      {formatDate(row.OriginalDeadline)}
                    </span>
                  </td>

                  {/* ExtensionDeadline */}
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {formatDate(row.ExtensionDeadline)}
                  </td>

                  {/* HolidayEligible */}
                  <td className="px-3 py-2">
                    {row.HolidayEligible === "Yes" ? (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">No</span>
                    )}
                  </td>

                  {/* HolidayLocation */}
                  <td className="px-3 py-2 text-gray-500 text-[11px]">
                    {row.HolidayLocation ?? "—"}
                  </td>

                  {/* DisasterEligible */}
                  <td className="px-3 py-2">
                    {row.DisasterEligible === "Yes" ? (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">No</span>
                    )}
                  </td>

                  {/* DisasterName */}
                  <td className="px-3 py-2 text-gray-600 text-[11px]">
                    {row.DisasterName ?? "—"}
                  </td>

                  {/* DisasterLocation */}
                  <td className="px-3 py-2 text-gray-600 text-[11px]">
                    {row.DisasterLocation ?? "—"}
                  </td>

                  {/* DisasterCounties */}
                  <td className="px-3 py-2 text-gray-500 text-[11px] max-w-xs">
                    <span
                      title={row.DisasterCounties ?? ""}
                      className="block truncate"
                    >
                      {row.DisasterCounties ?? "—"}
                    </span>
                  </td>

                  {/* DisasterDeadline */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.DisasterDeadline ? (
                      <span className="text-red-600 font-medium text-[11px]">
                        {formatDate(row.DisasterDeadline)}
                      </span>
                    ) : "—"}
                  </td>

                  {/* SourceType */}
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      row.SourceType === "HISTORICAL"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {row.SourceType ?? "—"}
                    </span>
                  </td>

                  {/* SourceURL */}
                  <td className="px-3 py-2 text-gray-400 text-[10px] max-w-xs">
                    <span
                      title={row.SourceURL ?? ""}
                      className="block truncate"
                    >
                      {row.SourceURL ?? "—"}
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