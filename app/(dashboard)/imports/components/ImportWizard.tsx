"use client"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"

interface ImportRow {
  [key: string]: string
}

interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: number
  clientsCreated: number
  details: string[]
}

const COLUMN_MAPPING: Record<string, string> = {
  "client name":                "client name",
  "entity name":                "client name",
  "entity type":                "entity type",
  "jurisdiction":               "jurisdiction",
  "tax type":                   "tax type",
  "financial year-end":         "financial year-end",
  "form number":                "form number",
  "form name":                  "form name",
  "date extension filed":       "date extension filed",
  "extended due date":          "extended due date",
  "date return filed":          "date return filed",
  "expected/internal due date": "expected/internal due date",
  "mandate partner":            "mandate partner",
  "mandate manager":            "mandate manager",
  "mandate preparer":           "mandate preparer",
  "client partner":             "client partner",
  "client manager":             "client manager",
  "notes":                      "notes",
  "client number":              "client number",
  "mandate number":             "mandate number",
}

export default function ImportWizard() {
  const [step, setStep]               = useState<1 | 2 | 3 | 4>(1)
  const [file, setFile]               = useState<File | null>(null)
  const [rows, setRows]               = useState<ImportRow[]>([])
  const [headers, setHeaders]         = useState<string[]>([])
  const [preview, setPreview]         = useState<ImportRow[]>([])
  const [importing, setImporting]     = useState(false)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [error, setError]             = useState<string>("")
  const [dragOver, setDragOver]       = useState(false)
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  function normalizeHeader(h: string): string {
    return h.toLowerCase().trim()
  }

  function handleFile(f: File) {
    setFile(f)
    setError("")

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data    = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array", cellDates: true })
        const sheet   = workbook.Sheets[workbook.SheetNames[0]]
        const json    = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw:    false,
          defval: "",
        })

        if (json.length === 0) {
          setError("The Excel file appears to be empty.")
          return
        }

        // Normalize headers
        const normalizedRows: ImportRow[] = json.map(row => {
          const newRow: ImportRow = {}
          Object.entries(row).forEach(([key, val]) => {
            const normalized = normalizeHeader(key)
            const mapped     = COLUMN_MAPPING[normalized] ?? normalized
            newRow[mapped]   = String(val ?? "")
          })
          return newRow
        })

        const hdrs = Object.keys(normalizedRows[0] ?? {})
        setHeaders(hdrs)
        setRows(normalizedRows)
        setPreview(normalizedRows.slice(0, 100))
        setStep(2)
      } catch (err) {
        setError(`Failed to read file: ${err}`)
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv"))) {
      handleFile(f)
    } else {
      setError("Please upload an Excel (.xlsx, .xls) or CSV file")
    }
  }

  async function handleImport() {
    setImporting(true)
    setError("")
    try {
      const res = await fetch("/api/imports", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
        setStep(4)
      }
    } catch (err) {
      setError(`Import failed: ${err}`)
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setStep(1)
    setFile(null)
    setRows([])
    setHeaders([])
    setPreview([])
    setResult(null)
    setError("")
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Import Mandates</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Import mandate data from Excel or CSV
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Upload" },
            { n: 2, label: "Preview" },
            { n: 3, label: "Confirm" },
            { n: 4, label: "Done" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s.n
                    ? "bg-orange-500 text-white"
                    : step > s.n
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {step > s.n ? "✓" : s.n}
                </div>
                <span className={`text-xs ${
                  step === s.n ? "text-orange-500 font-medium" : "text-gray-400"
                }`}>
                  {s.label}
                </span>
              </div>
              {i < 3 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-auto p-6">

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            ❌ {error}
          </div>
        )}

        {/* ── STEP 1: UPLOAD ── */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 hover:border-orange-300 hover:bg-gray-50"
              }`}
            >
              <div className="text-4xl mb-4">📊</div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Drop your Excel or CSV file here
              </p>
              <p className="text-xs text-gray-400 mb-4">
                or click to browse
              </p>
              <p className="text-xs text-gray-300">
                Supports .xlsx, .xls, .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>

            {/* Expected columns */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium text-gray-700 mb-3">
                Expected columns in your Excel file:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  "client name",
                  "entity type",
                  "jurisdiction",
                  "financial year-end",
                  "form number",
                  "date extension filed",
                  "extended due date",
                  "date return filed",
                  "expected/internal due date",
                  "mandate partner",
                  "mandate manager",
                  "mandate preparer",
                  "client partner",
                  "client manager",
                  "notes",
                ].map(col => (
                  <div key={col} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500">{col}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: PREVIEW ── */}
        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  📄 {file?.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                {rows.length} rows found — showing first {Math.min(rows.length, 100)} rows
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  ← Upload different file
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
                >
                  Continue →
                </button>
              </div>
            </div>

            <div className="overflow-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {headers.map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      {headers.map(h => (
                        <td key={h} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-xs truncate">
                          {row[h] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STEP 3: CONFIRM ── */}
        {step === 3 && (
          <div className="max-w-lg mx-auto">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Ready to import
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {rows.length} rows from {file?.name}
              </p>

              <div className="text-left bg-white rounded-lg p-4 mb-4 text-xs text-gray-600 space-y-1">
                <p>✅ Rows with no form number will be skipped</p>
                <p>✅ State forms (F-1065 etc) will be skipped for now</p>
                <p>✅ New clients will be created automatically</p>
                <p>✅ Duplicate mandates will be skipped</p>
                <p>✅ Deadlines will be pulled from Tax Calendar</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Importing...
                    </span>
                  ) : "Import now"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: DONE ── */}
        {step === 4 && result && (
          <div className="max-w-lg mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm font-semibold text-gray-800 mb-4">
                Import complete
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-gray-500">Mandates imported</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-600">{result.clientsCreated}</p>
                  <p className="text-xs text-gray-500">Clients created</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                  <p className="text-xs text-gray-500">Rows skipped</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-500">{result.errors}</p>
                  <p className="text-xs text-gray-500">Errors</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
                >
                  Import another file
                </button>
                <a
                  href="/mandates"
                  className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 text-center"
                >
                  View mandates 
                </a>
              </div>
            </div>

            {/* Details log */}
            {result.details.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-medium text-gray-600">Import log</p>
                </div>
                <div className="max-h-64 overflow-y-auto p-3 space-y-0.5">
                  {result.details.map((d, i) => (
                    <p key={i} className={`text-[11px] ${
                      d.startsWith("✅") ? "text-green-600" :
                      d.startsWith("❌") ? "text-red-500" :
                      "text-gray-500"
                    }`}>
                      {d}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}