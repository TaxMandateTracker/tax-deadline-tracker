"use client"

import { useState } from "react"
import * as XLSX from "xlsx"

interface ExportOption {
  type: string
  label: string
  description: string
  icon: string
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    type:        "mandates",
    label:       "Mandate Tracker",
    description: "All mandates with deadlines, staff, partners and stages",
    icon:        "📋",
  },
  {
    type:        "clients",
    label:       "Client List",
    description: "All clients with jurisdiction, FYE and entity type",
    icon:        "🏢",
  },
  {
    type:        "staff",
    label:       "Staff List",
    description: "All staff members with roles and working hours",
    icon:        "👤",
  },
]

export default function ExportsPage() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [message, setMessage]     = useState<string>("")

  async function handleExport(type: string, label: string) {
    setExporting(type)
    setMessage("")
    try {
      const res  = await fetch(`/api/exports?type=${type}`)
      const data = await res.json()

      if (data.error) {
        setMessage(`❌ ${data.error}`)
        return
      }

      const rows = data.rows
      if (!rows || rows.length === 0) {
        setMessage(`⚠️ No data found to export`)
        return
      }

      // Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook  = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, label)

      // Auto column widths
      const cols = Object.keys(rows[0]).map(key => ({
        wch: Math.max(
          key.length,
          ...rows.map((r: Record<string, unknown>) => String(r[key] ?? "").length)
        ) + 2
      }))
      worksheet["!cols"] = cols

      // Download
      const filename = `${label.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
      XLSX.writeFile(workbook, filename)

      setMessage(`✅ Exported ${rows.length} rows to ${filename}`)

    } catch (error) {
      setMessage(`❌ Export failed: ${error}`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-sm font-semibold text-gray-900">Export Data</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Download your data as Excel files
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">

          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-xs font-medium ${
              message.startsWith("✅")
                ? "bg-green-50 border border-green-200 text-green-700"
                : message.startsWith("⚠️")
                ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {message}
            </div>
          )}

          <div className="grid gap-4">
            {EXPORT_OPTIONS.map(option => (
              <div
                key={option.type}
                className="border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{option.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport(option.type, option.label)}
                  disabled={exporting === option.type}
                  className="text-xs bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                >
                  {exporting === option.type ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>📥 Export to Excel</>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-medium text-gray-600 mb-2">Export includes:</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                "All active records",
                "All deadline columns",
                "Staff assignments",
                "Partner assignments",
                "Current stage",
                "Budget amounts",
                "Extension details",
                "Jurisdiction info",
              ].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  <span className="text-[11px] text-gray-500">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}