"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/lib/context/UserContext"
import type { Staff, Partner, Manager, ServiceLine, CurrentStage, Mandate } from "./MandateTracker"

interface Props {
  mandate: Mandate | null
  onClose: () => void
  onUpdate: (updated: Mandate) => void
  staffList: Staff[]
  stages: CurrentStage[]
  serviceLines: ServiceLine[]
  partners: Partner[]
  managers: Manager[]
}

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

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  ).toISOString().split("T")[0]
}

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

export default function MandateDetailPanel({
  mandate,
  onClose,
  onUpdate,
  staffList,
  stages,
  serviceLines,
  partners,
  managers,
}: Props) {
  const { isPartner, isITAdmin } = useUser()
  const canOverride = isPartner || isITAdmin

  const [saving, setSaving]                         = useState(false)
  const [activeTab, setActiveTab]                   = useState<"details" | "deadlines" | "audit">("details")
  const [changeReason, setChangeReason]             = useState("")

  // Editable fields
  const [currentStageID, setCurrentStageID]         = useState<number | null>(null)
  const [assignedStaffID, setAssignedStaffID]       = useState<number | null>(null)
  const [assistingStaffID, setAssistingStaffID]     = useState<number | null>(null)
  const [clientPartnerID, setClientPartnerID]       = useState<number | null>(null)
  const [mandatePartnerID, setMandatePartnerID]     = useState<number | null>(null)
  const [mandateManagerID, setMandateManagerID]     = useState<number | null>(null)
  const [clientManagerID, setClientManagerID]       = useState<number | null>(null)
  const [serviceLineID, setServiceLineID]           = useState<number | null>(null)
  const [budget, setBudget]                         = useState("")
  const [clientCommitmentDate, setClientCommitmentDate] = useState("")
  const [staffDueDate, setStaffDueDate]             = useState("")
  const [extensionFiled, setExtensionFiled]         = useState(false)
  const [extensionFiledDate, setExtensionFiledDate] = useState("")
  const [deadlineType, setDeadlineType]             = useState<string | null>(null)

  useEffect(() => {
    if (mandate) {
      setCurrentStageID(mandate.CurrentStage?.CurrentStageID ?? null)
      setAssignedStaffID(mandate.AssignedStaff?.StaffID ?? null)
      setAssistingStaffID(mandate.AssistingStaff?.StaffID ?? null)
      setClientPartnerID(mandate.ClientPartner?.PartnerID ?? null)
      setMandatePartnerID(mandate.MandatePartner?.PartnerID ?? null)
      setMandateManagerID(mandate.MandateManager?.ManagerID ?? null)
      setClientManagerID(mandate.ClientManager?.ManagerID ?? null)
      setServiceLineID(mandate.ServiceLine?.ServiceLineID ?? null)
      setBudget(mandate.Budget ? String(mandate.Budget) : "")
      setClientCommitmentDate(toInputDate(mandate.ClientCommitmentDate))
      setStaffDueDate(toInputDate(mandate.StaffDueDate))
      setExtensionFiled(mandate.ExtensionFiled)
      setExtensionFiledDate(toInputDate(mandate.ExtensionFiledDate))
      setDeadlineType(mandate.DeadlineType)
      setChangeReason("")
      setActiveTab("details")
    }
  }, [mandate])

  if (!mandate) return null

  async function handleSave() {
    if (!mandate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/mandates/${mandate.JobID}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          CurrentStageID:      currentStageID,
          AssignedStaffID:     assignedStaffID,
          AssistingStaffID:    assistingStaffID,
          ClientPartnerID:     clientPartnerID,
          MandatePartnerID:    mandatePartnerID,
          MandateManagerID:    mandateManagerID,
          ClientManagerID:     clientManagerID,
          ServiceLineID:       serviceLineID,
          Budget:              budget ? parseFloat(budget) : null,
          ClientCommitmentDate: clientCommitmentDate || null,
          StaffDueDate:        staffDueDate || null,
          ExtensionFiled:      extensionFiled,
          ExtensionFiledDate:  extensionFiledDate || null,
          DeadlineType:        deadlineType,
          ChangeReason:        changeReason || null,
        }),
      })
      const updated = await res.json()
      onUpdate(updated)
      onClose()
    } catch (error) {
      console.error("Failed to save mandate:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 leading-tight">
              {mandate.JobName}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mandate.Client?.ClientName} · {mandate.FormType} · {mandate.TaxYear}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-4"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { key: "details",   label: "Details" },
            { key: "deadlines", label: "Deadlines" },
            { key: "audit",     label: "Audit Trail" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`text-xs px-4 py-2.5 border-b-2 transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <div className="flex flex-col gap-4">

              {/* Current Stage */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Current Stage</label>
                <select
                  value={currentStageID ?? ""}
                  onChange={e => setCurrentStageID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">Select stage...</option>
                  {stages.map(s => (
                    <option key={s.CurrentStageID} value={s.CurrentStageID}>
                      {s.CurrentStage}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Line */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Service Line</label>
                <select
                  value={serviceLineID ?? ""}
                  onChange={e => setServiceLineID(e.target.value ? parseInt(e.target.value) : null)}
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
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Client Partner */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Client Partner</label>
                <select
                  value={clientPartnerID ?? ""}
                  onChange={e => setClientPartnerID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {partners.map(p => (
                    <option key={p.PartnerID} value={p.PartnerID}>
                      {p.PartnerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mandate Partner */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Mandate Partner</label>
                <select
                  value={mandatePartnerID ?? ""}
                  onChange={e => setMandatePartnerID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {partners.map(p => (
                    <option key={p.PartnerID} value={p.PartnerID}>
                      {p.PartnerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mandate Manager */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Mandate Manager</label>
                <select
                  value={mandateManagerID ?? ""}
                  onChange={e => setMandateManagerID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {managers.map(m => (
                    <option key={m.ManagerID} value={m.ManagerID}>
                      {m.ManagerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Manager */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Client Manager</label>
                <select
                  value={clientManagerID ?? ""}
                  onChange={e => setClientManagerID(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                >
                  <option value="">None</option>
                  {managers.map(m => (
                    <option key={m.ManagerID} value={m.ManagerID}>
                      {m.ManagerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Staff */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Assigned Staff</label>
                <select
                  value={assignedStaffID ?? ""}
                  onChange={e => setAssignedStaffID(e.target.value ? parseInt(e.target.value) : null)}
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
                  value={assistingStaffID ?? ""}
                  onChange={e => setAssistingStaffID(e.target.value ? parseInt(e.target.value) : null)}
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

              {/* Read only info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-600 mb-2">Mandate Info</p>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Client</span>
                  <span className="text-xs text-gray-700 font-medium">{mandate.Client?.ClientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Form Type</span>
                  <span className="text-xs text-gray-700">{mandate.FormType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Entity Type</span>
                  <span className="text-xs text-gray-700">{mandate.EntityType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">FYE</span>
                  <span className="text-xs text-gray-700">{formatDate(mandate.FYE)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Tax Year</span>
                  <span className="text-xs text-gray-700">{mandate.TaxYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Jurisdiction</span>
                  <span className="text-xs text-gray-700">{mandate.Jurisdiction ?? "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── DEADLINES TAB ── */}
          {activeTab === "deadlines" && (
            <div className="flex flex-col gap-4">

              {/* Legal Due Date — read only */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Legal Due Date</p>
                <p className={`text-sm font-medium ${getDeadlineColor(mandate.LegalDueDate)}`}>
                  {formatDate(mandate.LegalDueDate)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Controlled by Tax Calendar — cannot be edited
                </p>
              </div>

              {/* Extended Due Date — read only */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Extended Due Date</p>
                <p className={`text-sm font-medium ${
                  extensionFiled
                    ? getDeadlineColor(mandate.ExtendedDueDate)
                    : "text-gray-400"
                }`}>
                  {formatDate(mandate.ExtendedDueDate)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Controlled by Tax Calendar — cannot be edited
                </p>
              </div>

              {/* Extension Filed */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">Extension Filed</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extensionFiled}
                      onChange={e => setExtensionFiled(e.target.checked)}
                      className="accent-orange-500 w-4 h-4"
                    />
                    <span className="text-xs text-gray-600">
                      {extensionFiled ? "Yes" : "No"}
                    </span>
                  </label>
                </div>
                {extensionFiled && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Extension Filed Date</label>
                    <input
                      type="date"
                      value={extensionFiledDate}
                      onChange={e => setExtensionFiledDate(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                    />
                  </div>
                )}
              </div>

              {/* Client Commitment Date */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Client Commitment Date
                </label>
                <input
                  type="date"
                  value={clientCommitmentDate}
                  onChange={e => setClientCommitmentDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  When client promises to submit documents
                </p>
              </div>

              {/* Internal Due Date */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Internal Due Date
                </label>
                <input
                  type="date"
                  value={staffDueDate}
                  onChange={e => setStaffDueDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Firm internal deadline for staff
                </p>
              </div>

              {/* Disaster Deadline */}
              {mandate.DisasterDueDate && (
                <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <p className="text-xs font-medium text-red-700 mb-1">
                    Disaster Deadline — {mandate.DisasterName}
                  </p>
                  <p className={`text-sm font-medium ${getDeadlineColor(mandate.DisasterDueDate)}`}>
                    {formatDate(mandate.DisasterDueDate)}
                  </p>
                  {mandate.DisasterDueDate && canOverride && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600 block mb-1">
                        Set as active deadline
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeadlineType("DISASTER")}
                          className={`text-xs px-3 py-1 rounded border transition-colors ${
                            deadlineType === "DISASTER"
                              ? "bg-red-500 text-white border-red-500"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Use Disaster Deadline
                        </button>
                        <button
                          onClick={() => setDeadlineType(null)}
                          className={`text-xs px-3 py-1 rounded border transition-colors ${
                            deadlineType !== "DISASTER"
                              ? "bg-gray-100 text-gray-700 border-gray-200"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Use Legal Deadline
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Change Reason */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Reason for change (optional)
                </label>
                <textarea
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  placeholder="e.g. Client requested extension, disaster relief applied..."
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── AUDIT TRAIL TAB ── */}
          {activeTab === "audit" && (
            <div className="flex flex-col gap-2">
              {mandate.AuditTrail.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  No audit trail entries yet
                </p>
              ) : (
                mandate.AuditTrail.map(entry => (
                  <div key={entry.AuditID} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {entry.FieldChanged}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatDate(entry.ChangedDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-gray-400 line-through">
                        {entry.OldValue ?? "—"}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-700 font-medium">
                        {entry.NewValue ?? "—"}
                      </span>
                    </div>
                    {entry.ChangeReason && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {entry.ChangeReason}
                      </p>
                    )}
                    {entry.ChangedByStaff && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        By {entry.ChangedByStaff.FirstName} {entry.ChangedByStaff.LastName}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </>
  )
}