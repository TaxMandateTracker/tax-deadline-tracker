"use client"

import { useEffect, useState, useMemo } from "react"
import { useUser } from "@/lib/context/UserContext"

// ─────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────

interface Staff {
  StaffID: number
  FirstName: string
  LastName: string
  Email: string
}

interface Partner {
  PartnerID: number
  PartnerName: string
  Email: string
}

interface Manager {
  ManagerID: number
  ManagerName: string
  Email: string
}

interface ServiceLine {
  ServiceLineID: number
  ServiceLine: string
}

interface CurrentStage {
  CurrentStageID: number
  CurrentStage: string
  IsPipeline: boolean
  IsCompleted: boolean
  IsLost: boolean
}

interface Client {
  ClientID: number
  ClientName: string
  ClientJurisdiction: string
  ClientFYEDate: string | null
  ClientState: string | null
  ClientCounty: string | null
  ClientZipCode: string | null
  EntityType: string | null
}

interface AuditEntry {
  CreatedDate: string
  CreatedByStaff: { FirstName: string; LastName: string } | null
}

interface Mandate {
  JobID: number
  JobName: string
  FYE: string
  TaxYear: number
  FormType: string
  EntityType: string
  Jurisdiction: string
  Budget: number | null
  ClientCommitmentDate: string | null
  StaffDueDate: string | null
  ExtensionFiled: boolean
  DeadlineType: string | null
  LegalDueDate: string | null
  ExtendedDueDate: string | null
  DisasterDueDate: string | null
  DisasterName: string | null
  DisasterLocation: string | null
  DisasterCounties: string | null
  Client: Client
  ServiceLine: ServiceLine | null
  ClientPartner: Partner | null
  MandatePartner: Partner | null
  Manager: Manager | null
  AssignedStaff: Staff | null
  AssistingStaff: Staff | null
  CurrentStage: CurrentStage | null
  AuditTrail: AuditEntry[]
}

// ─────────────────────────────────────────
// COLUMN DEFINITIONS
// ─────────────────────────────────────────

interface ColumnDef {
  key: string
  label: string
  defaultVisible: boolean
  width: string
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "ClientName",           label: "Client Name",          defaultVisible: true,  width: "w-40" },
  { key: "ClientJurisdiction",   label: "Jurisdiction",         defaultVisible: true,  width: "w-24" },
  { key: "ClientFYEDate",        label: "FYE Date",             defaultVisible: true,  width: "w-24" },
  { key: "JobName",              label: "Mandate Name",         defaultVisible: true,  width: "w-48" },
  { key: "ServiceLine",          label: "Service Line",         defaultVisible: true,  width: "w-36" },
  { key: "ClientPartner",        label: "Client Partner",       defaultVisible: true,  width: "w-32" },
  { key: "MandatePartner",       label: "Mandate Partner",      defaultVisible: true,  width: "w-32" },
  { key: "Manager",              label: "Staff Lead",           defaultVisible: true,  width: "w-32" },
  { key: "AssignedStaff",        label: "Assigned Staff",       defaultVisible: true,  width: "w-32" },
  { key: "AssistingStaff",       label: "Assisting Staff",      defaultVisible: true,  width: "w-32" },
  { key: "ClientCommitmentDate", label: "Client Commitment",    defaultVisible: true,  width: "w-28" },
  { key: "StaffDueDate",         label: "Internal Due Date",    defaultVisible: true,  width: "w-28" },
  { key: "LegalDueDate",         label: "Legal Due Date",       defaultVisible: true,  width: "w-28" },
  { key: "ExtendedDueDate",      label: "Extended Due Date",    defaultVisible: true,  width: "w-28" },
  { key: "DisasterDueDate",      label: "Disaster Deadline",    defaultVisible: true,  width: "w-28" },
  { key: "CurrentStage",         label: "Current Stage",        defaultVisible: true,  width: "w-36" },
  { key: "Budget",               label: "Budget",               defaultVisible: true,  width: "w-24" },
  { key: "ExtensionFiled",       label: "Extension Filed",      defaultVisible: false, width: "w-24" },
  { key: "FormType",             label: "Form Type",            defaultVisible: false, width: "w-20" },
  { key: "TaxYear",              label: "Tax Year",             defaultVisible: false, width: "w-20" },
  { key: "CreatedDate",          label: "Created Date",         defaultVisible: false, width: "w-24" },
  { key: "CreatedBy",            label: "Created By",           defaultVisible: false, width: "w-28" },
]

const STAGE_COLORS: Record<string, string> = {
  "Preparation & Analysis":        "bg-blue-100 text-blue-700",
  "Opportunity Identified":        "bg-purple-100 text-purple-700",
  "Scoping & Pricing":             "bg-indigo-100 text-indigo-700",
  "Awaiting Client Approval":      "bg-yellow-100 text-yellow-700",
  "Gathering Information":         "bg-orange-100 text-orange-700",
  "Internal Review":               "bg-cyan-100 text-cyan-700",
  "Partner Review":                "bg-teal-100 text-teal-700",
  "Waiting on Client/Third Party": "bg-amber-100 text-amber-700",
  "Implementation":                "bg-green-100 text-green-700",
  "Completed":                     "bg-gray-100 text-gray-600",
  "Lost":                          "bg-red-100 text-red-700",
}

// ─────────────────────────────────────────
// DEADLINE COLOR LOGIC
// ─────────────────────────────────────────

function getDeadlineColor(dateStr: string | null): string {
  if (!dateStr) return "text-gray-400"
  const due  = new Date(dateStr)
  const now  = new Date()
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0)   return "text-red-600 font-bold"
  if (diff <= 7)  return "text-red-500 font-semibold"
  if (diff <= 14) return "text-orange-500 font-medium"
  return "text-green-600 font-medium"
}

function getDeadlineBg(dateStr: string | null): string {
  if (!dateStr) return ""
  const due  = new Date(dateStr)
  const now  = new Date()
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0)   return "bg-red-50"
  if (diff <= 7)  return "bg-red-50"
  if (diff <= 14) return "bg-orange-50"
  return "bg-green-50"
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  ).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  })
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase()
}

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────

export default function MandateTracker() {
  const { isPartner, isITAdmin } = useUser()

  const [mandates, setMandates]   = useState<Mandate[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState("active")
  const [search, setSearch]       = useState("")
  const [filterJurisdiction, setFilterJurisdiction] = useState("all")
  const [filterServiceLine, setFilterServiceLine]   = useState("all")
  const [filterStage, setFilterStage]               = useState("all")
  const [sortField, setSortField] = useState<string>("LegalDueDate")
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc")
  const [showColumnPicker, setShowColumnPicker]     = useState(false)
  const [showCreateModal, setShowCreateModal]       = useState(false)
  const [visibleColumns, setVisibleColumns]         = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))
  )

  // Lookup data
  const [clients, setClients]         = useState<Client[]>([])
  const [staffList, setStaffList]     = useState<Staff[]>([])
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([])

  // Create form state
  const [newClientID, setNewClientID]                     = useState<number>(0)
  const [newJobName, setNewJobName]                       = useState("")
  const [newFYE, setNewFYE]                               = useState("")
  const [newTaxYear, setNewTaxYear]                       = useState(new Date().getFullYear())
  const [newFormType, setNewFormType]                     = useState("1040")
  const [newEntityType, setNewEntityType]                 = useState("Individual")
  const [newJurisdiction, setNewJurisdiction]             = useState("US")
  const [newServiceLineID, setNewServiceLineID]           = useState<number | null>(null)
  const [newClientPartnerID, setNewClientPartnerID]       = useState<number | null>(null)
  const [newMandatePartnerID, setNewMandatePartnerID]     = useState<number | null>(null)
  const [newManagerID, setNewManagerID]                   = useState<number | null>(null)
  const [newAssignedStaffID, setNewAssignedStaffID]       = useState<number | null>(null)
  const [newAssistingStaffID, setNewAssistingStaffID]     = useState<number | null>(null)
  const [newCurrentStageID, setNewCurrentStageID]         = useState<number | null>(null)
  const [newBudget, setNewBudget]                         = useState("")
  const [newClientCommitmentDate, setNewClientCommitmentDate] = useState("")
  const [newInternalDueDate, setNewInternalDueDate]       = useState("")
  const [creating, setCreating]                           = useState(false)

  useEffect(() => {
    fetchMandates()
    fetchLookupData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function fetchMandates() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/mandates?view=${view}`)
      const data = await res.json()
      setMandates(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch mandates:", error)
      setMandates([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchLookupData() {
    try {
      const [clientsRes, staffRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/staff"),
      ])
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        setClients(Array.isArray(data) ? data : [])
      }
      if (staffRes.ok) {
        const data = await staffRes.json()
        setStaffList(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to fetch lookup data:", error)
    }
  }

  async function handleCreate() {
    if (!newJobName.trim() || !newClientID || !newFYE) return
    setCreating(true)
    try {
      const res = await fetch("/api/mandates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ClientID:             newClientID,
          JobName:              newJobName,
          FYE:                  newFYE,
          TaxYear:              newTaxYear,
          FormType:             newFormType,
          EntityType:           newEntityType,
          Jurisdiction:         newJurisdiction,
          ServiceLineID:        newServiceLineID,
          ClientPartnerID:      newClientPartnerID,
          MandatePartnerID:     newMandatePartnerID,
          ManagerID:            newManagerID,
          AssignedStaffID:      newAssignedStaffID,
          AssistingStaffID:     newAssistingStaffID,
          CurrentStageID:       newCurrentStageID,
          Budget:               newBudget ? parseFloat(newBudget) : null,
          ClientCommitmentDate: newClientCommitmentDate || null,
          InternalDueDate:      newInternalDueDate || null,
        }),
      })
      const created = await res.json()
      setMandates(prev => [created, ...prev])
      setShowCreateModal(false)
      setNewJobName("")
      setNewFYE("")
      setNewBudget("")
      setNewClientCommitmentDate("")
      setNewInternalDueDate("")
    } catch (error) {
      console.error("Failed to create mandate:", error)
    } finally {
      setCreating(false)
    }
  }

  async function handleDisasterOverride(jobId: number) {
    if (!canOverride) return
    try {
      await fetch(`/api/mandates/${jobId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ DeadlineType: "DISASTER" }),
      })
      fetchMandates()
    } catch (error) {
      console.error("Failed to set disaster override:", error)
    }
  }

  function toggleColumn(key: string) {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  function getSortIcon(field: string) {
    if (sortField !== field) return " ↕"
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const canOverride = isPartner || isITAdmin

  const uniqueServiceLines = [...new Set(
    mandates.map(m => m.ServiceLine?.ServiceLine).filter(Boolean)
  )]
  const uniqueStages = [...new Set(
    mandates.map(m => m.CurrentStage?.CurrentStage).filter(Boolean)
  )]

  const filteredAndSorted = useMemo(() => {
    const filtered = mandates.filter(m => {
      if (filterJurisdiction !== "all" && m.Jurisdiction !== filterJurisdiction) return false
      if (filterServiceLine !== "all" && m.ServiceLine?.ServiceLine !== filterServiceLine) return false
      if (filterStage !== "all" && m.CurrentStage?.CurrentStage !== filterStage) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          m.JobName?.toLowerCase().includes(q) ||
          m.Client?.ClientName?.toLowerCase().includes(q) ||
          m.AssignedStaff?.FirstName?.toLowerCase().includes(q) ||
          m.AssignedStaff?.LastName?.toLowerCase().includes(q) ||
          m.MandatePartner?.PartnerName?.toLowerCase().includes(q) ||
          m.FormType?.toLowerCase().includes(q)
        )
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null

      if (sortField === "ClientName")          { aVal = a.Client?.ClientName ?? "";          bVal = b.Client?.ClientName ?? "" }
      else if (sortField === "JobName")        { aVal = a.JobName;                           bVal = b.JobName }
      else if (sortField === "LegalDueDate")   { aVal = a.LegalDueDate ?? "";               bVal = b.LegalDueDate ?? "" }
      else if (sortField === "ExtendedDueDate"){ aVal = a.ExtendedDueDate ?? "";            bVal = b.ExtendedDueDate ?? "" }
      else if (sortField === "StaffDueDate")   { aVal = a.StaffDueDate ?? "";               bVal = b.StaffDueDate ?? "" }
      else if (sortField === "DisasterDueDate"){ aVal = a.DisasterDueDate ?? "";            bVal = b.DisasterDueDate ?? "" }
      else if (sortField === "CurrentStage")   { aVal = a.CurrentStage?.CurrentStage ?? ""; bVal = b.CurrentStage?.CurrentStage ?? "" }
      else if (sortField === "Budget")         { aVal = a.Budget ?? 0;                      bVal = b.Budget ?? 0 }
      else if (sortField === "ClientFYEDate")  { aVal = a.Client?.ClientFYEDate ?? "";      bVal = b.Client?.ClientFYEDate ?? "" }
      else if (sortField === "ClientCommitmentDate") { aVal = a.ClientCommitmentDate ?? ""; bVal = b.ClientCommitmentDate ?? "" }

      if (aVal === null) return 1
      if (bVal === null) return -1

      const compare = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal))

      return sortDir === "asc" ? compare : -compare
    })
  }, [mandates, search, filterJurisdiction, filterServiceLine, filterStage, sortField, sortDir])

  // ─────────────────────────────────────────
  // RENDER CELL
  // ─────────────────────────────────────────

  function renderCell(col: ColumnDef, mandate: Mandate) {
    switch (col.key) {

      case "ClientName":
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700 flex-shrink-0">
              {mandate.Client?.ClientName?.[0]?.toUpperCase()}
            </div>
            <span className="font-medium text-gray-800 truncate">
              {mandate.Client?.ClientName ?? "—"}
            </span>
          </div>
        )

            case "ClientJurisdiction":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
            {mandate.Jurisdiction ?? "—"}
          </span>
        )

      case "ClientFYEDate":
        return <span className="text-gray-600">{formatDate(mandate.Client?.ClientFYEDate ?? null)}</span>

      case "JobName":
        return (
          <div>
            <div className="font-medium text-gray-800 truncate">{mandate.JobName}</div>
            <div className="text-[10px] text-gray-400">{mandate.FormType} · {mandate.TaxYear}</div>
          </div>
        )

      case "ServiceLine":
        return mandate.ServiceLine ? (
          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
            {mandate.ServiceLine.ServiceLine}
          </span>
        ) : <span className="text-gray-400">—</span>

      case "ClientPartner":
        return <span className="text-gray-600 text-[11px]">{mandate.ClientPartner?.PartnerName ?? "—"}</span>

      case "MandatePartner":
        return <span className="text-gray-600 text-[11px]">{mandate.MandatePartner?.PartnerName ?? "—"}</span>

      case "Manager":
        return <span className="text-gray-600 text-[11px]">{mandate.Manager?.ManagerName ?? "—"}</span>

      case "AssignedStaff":
        return mandate.AssignedStaff ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[9px] font-medium text-orange-700 flex-shrink-0">
              {getInitials(mandate.AssignedStaff.FirstName, mandate.AssignedStaff.LastName)}
            </div>
            <span className="text-[11px] text-gray-600">
              {mandate.AssignedStaff.FirstName} {mandate.AssignedStaff.LastName}
            </span>
          </div>
        ) : <span className="text-gray-400">—</span>

      case "AssistingStaff":
        return mandate.AssistingStaff ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-medium text-gray-600 flex-shrink-0">
              {getInitials(mandate.AssistingStaff.FirstName, mandate.AssistingStaff.LastName)}
            </div>
            <span className="text-[11px] text-gray-600">
              {mandate.AssistingStaff.FirstName} {mandate.AssistingStaff.LastName}
            </span>
          </div>
        ) : <span className="text-gray-400">—</span>

      case "ClientCommitmentDate":
        return (
          <span className={getDeadlineColor(mandate.ClientCommitmentDate)}>
            {formatDate(mandate.ClientCommitmentDate)}
          </span>
        )

      case "StaffDueDate":
        return mandate.StaffDueDate ? (
          <div className={`px-1.5 py-0.5 rounded text-[11px] ${getDeadlineBg(mandate.StaffDueDate)}`}>
            <span className={getDeadlineColor(mandate.StaffDueDate)}>
              {formatDate(mandate.StaffDueDate)}
            </span>
          </div>
        ) : <span className="text-gray-400">—</span>

      case "LegalDueDate":
        return mandate.LegalDueDate ? (
          <div className={`px-1.5 py-0.5 rounded text-[11px] ${getDeadlineBg(mandate.LegalDueDate)}`}>
            <span className={getDeadlineColor(mandate.LegalDueDate)}>
              {formatDate(mandate.LegalDueDate)}
            </span>
          </div>
        ) : <span className="text-gray-400">—</span>

      case "ExtendedDueDate":
        return mandate.ExtendedDueDate ? (
          <div className={`px-1.5 py-0.5 rounded text-[11px] ${
            mandate.ExtensionFiled ? getDeadlineBg(mandate.ExtendedDueDate) : ""
          }`}>
            <span className={
              mandate.ExtensionFiled
                ? getDeadlineColor(mandate.ExtendedDueDate)
                : "text-gray-400"
            }>
              {formatDate(mandate.ExtendedDueDate)}
            </span>
            {mandate.ExtensionFiled && (
              <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">
                Filed
              </span>
            )}
          </div>
        ) : <span className="text-gray-400">—</span>

      case "DisasterDueDate":
        return mandate.DisasterDueDate ? (
          <div className={`px-1.5 py-0.5 rounded text-[11px] ${
            mandate.DeadlineType === "DISASTER"
              ? getDeadlineBg(mandate.DisasterDueDate)
              : "bg-gray-50"
          }`}>
            <span className={
              mandate.DeadlineType === "DISASTER"
                ? getDeadlineColor(mandate.DisasterDueDate)
                : "text-gray-400"
            }>
              {formatDate(mandate.DisasterDueDate)}
            </span>
            {mandate.DisasterName && (
              <div className="text-[9px] text-red-500 truncate mt-0.5">
                {mandate.DisasterName}
              </div>
            )}
            {canOverride && mandate.DeadlineType !== "DISASTER" && (
              <button
                onClick={() => handleDisasterOverride(mandate.JobID)}
                className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5 block"
              >
                Set as active
              </button>
            )}
          </div>
        ) : <span className="text-gray-400">—</span>

      case "CurrentStage":
        return mandate.CurrentStage ? (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            STAGE_COLORS[mandate.CurrentStage.CurrentStage] ?? "bg-gray-100 text-gray-600"
          }`}>
            {mandate.CurrentStage.CurrentStage}
          </span>
        ) : <span className="text-gray-400">—</span>

      case "Budget":
        return <span className="text-gray-700">{formatCurrency(mandate.Budget)}</span>

      case "ExtensionFiled":
        return (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            mandate.ExtensionFiled
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {mandate.ExtensionFiled ? "Yes" : "No"}
          </span>
        )

      case "FormType":
        return <span className="text-gray-600 text-[11px]">{mandate.FormType}</span>

      case "TaxYear":
        return <span className="text-gray-600">{mandate.TaxYear}</span>

      case "CreatedDate":
        return (
          <span className="text-gray-500 text-[11px]">
            {mandate.AuditTrail?.[0]
              ? formatDate(mandate.AuditTrail[0].CreatedDate)
              : "—"}
          </span>
        )

      case "CreatedBy":
        return (
          <span className="text-gray-500 text-[11px]">
            {mandate.AuditTrail?.[0]?.CreatedByStaff
              ? `${mandate.AuditTrail[0].CreatedByStaff.FirstName} ${mandate.AuditTrail[0].CreatedByStaff.LastName}`
              : "—"}
          </span>
        )

      default:
        return <span className="text-gray-400">—</span>
    }
  }

  const visibleCols = ALL_COLUMNS.filter(c => visibleColumns[c.key])

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">
            Mandate Tracker {new Date().getFullYear()}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredAndSorted.length} mandates
          </p>
        </div>

        {/* View tabs */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {[
            { key: "active",    label: "00. Active Mandates" },
            { key: "pipeline",  label: "01. Pipeline" },
            { key: "completed", label: "02. Completed" },
            { key: "lost",      label: "03. Lost" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`text-xs px-3 py-1.5 whitespace-nowrap transition-colors ${
                view === tab.key
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
        >
          + New mandate
        </button>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2 flex-wrap">

        {/* Search */}
        <input
          type="text"
          placeholder="Search mandate, client, staff..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 w-56 focus:outline-none focus:border-orange-400"
        />

        {/* Jurisdiction */}
        <select
          value={filterJurisdiction}
          onChange={e => setFilterJurisdiction(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none"
        >
          <option value="all">All jurisdictions</option>
          <option value="US">US</option>
          <option value="Canada">Canada</option>
        </select>

        {/* Service Line */}
        <select
          value={filterServiceLine}
          onChange={e => setFilterServiceLine(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none"
        >
          <option value="all">All service lines</option>
          {uniqueServiceLines.map(sl => (
            <option key={sl}>{sl}</option>
          ))}
        </select>

        {/* Stage */}
        <select
          value={filterStage}
          onChange={e => setFilterStage(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none"
        >
          <option value="all">All stages</option>
          {uniqueStages.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {/* Column picker */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            ⚙ Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-64 p-3 max-h-96 overflow-y-auto">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Show / hide columns
              </p>
              <div className="flex flex-col gap-1">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="accent-orange-500"
                    />
                    <span className="text-xs text-gray-600">{col.label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => setShowColumnPicker(false)}
                className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded py-1"
              >
                Done
              </button>
            </div>
          )}
        </div>

        <span className="text-xs text-gray-400">
          {filteredAndSorted.length} of {mandates.length} mandates
        </span>
      </div>

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-sm text-gray-400">Loading mandates...</p>
            </div>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-gray-400">No mandates found</p>
              <p className="text-xs text-gray-300 mt-1">
                Click + New mandate to create one
              </p>
            </div>
          </div>
        ) : (
          <table
            className="w-full border-collapse text-xs"
            style={{ minWidth: `${visibleCols.length * 140}px` }}
          >
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                {visibleCols.map(col => (
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
              {filteredAndSorted.map(mandate => (
                <tr
                  key={mandate.JobID}
                  className="border-b border-gray-100 hover:bg-blue-50/20 cursor-pointer"
                >
                  {visibleCols.map(col => (
                    <td key={col.key} className="px-3 py-2 align-middle">
                      {renderCell(col, mandate)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CREATE MANDATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-[560px] shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              New Mandate
            </h3>
            <div className="grid grid-cols-2 gap-3">

              {/* Client */}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Client *</label>
                <select
                  value={newClientID}
                  onChange={e => setNewClientID(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value={0}>Select client...</option>
                  {clients.map(c => (
                    <option key={c.ClientID} value={c.ClientID}>
                      {c.ClientName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mandate Name */}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Mandate Name *</label>
                <input
                  type="text"
                  value={newJobName}
                  onChange={e => setNewJobName(e.target.value)}
                  placeholder="e.g. IrotexPlus - Freeze 2026"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                  autoFocus
                />
              </div>

              {/* FYE */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">FYE Date *</label>
                <input
                  type="date"
                  value={newFYE}
                  onChange={e => setNewFYE(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Tax Year */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tax Year</label>
                <input
                  type="number"
                  value={newTaxYear}
                  onChange={e => setNewTaxYear(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Form Type */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Form Type</label>
                <select
                  value={newFormType}
                  onChange={e => setNewFormType(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  {["1040","1041","1065","1120","1120F","1120S","990","W-2/1099","941","T1","T2","T3","T4/T5","T3010","GST/HST"].map(f => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Jurisdiction */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Jurisdiction</label>
                <select
                  value={newJurisdiction}
                  onChange={e => setNewJurisdiction(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="US">US</option>
                  <option value="Canada">Canada</option>
                </select>
              </div>

              {/* Entity Type */}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Entity Type</label>
                <select
                  value={newEntityType}
                  onChange={e => setNewEntityType(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  {["Individual","Self-employed","S-Corporation","Partnership","C-Corporation","Non-profit","Trust/Estate","Employers","Payroll quarterly","Foreign-Corporation","Corporation","Trust","Registered charity","Annual filer"].map(e => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>

              {/* Service Line */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Service Line</label>
                <select
                  value={newServiceLineID ?? ""}
                  onChange={e => setNewServiceLineID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {serviceLines.map(sl => (
                    <option key={sl.ServiceLineID} value={sl.ServiceLineID}>
                      {sl.ServiceLine}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Budget ($)</label>
                <input
                  type="number"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Assigned Staff */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Assigned Staff</label>
                <select
                  value={newAssignedStaffID ?? ""}
                  onChange={e => setNewAssignedStaffID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {staffList.map(s => (
                    <option key={s.StaffID} value={s.StaffID}>
                      {s.FirstName} {s.LastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assisting Staff */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Assisting Staff</label>
                <select
                  value={newAssistingStaffID ?? ""}
                  onChange={e => setNewAssistingStaffID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {staffList.map(s => (
                    <option key={s.StaffID} value={s.StaffID}>
                      {s.FirstName} {s.LastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Commitment Date */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Client Commitment Date</label>
                <input
                  type="date"
                  value={newClientCommitmentDate}
                  onChange={e => setNewClientCommitmentDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Internal Due Date */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Internal Due Date</label>
                <input
                  type="date"
                  value={newInternalDueDate}
                  onChange={e => setNewInternalDueDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreate}
                disabled={creating || !newJobName.trim() || !newClientID || !newFYE}
                className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create mandate"}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close column picker on outside click */}
      {showColumnPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowColumnPicker(false)}
        />
      )}
    </div>
  )
}