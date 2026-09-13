import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") ?? "mandates"

    if (type === "mandates") {
      const mandates = await prisma.tblJob.findMany({
        where: { IsActive: true },
        include: {
          Client:         true,
          ServiceLine:    true,
          ClientPartner:  true,
          MandatePartner: true,
          MandateManager: true,
          ClientManager:  true,
          AssignedStaff:  true,
          AssistingStaff: true,
          CurrentStage:   true,
        },
        orderBy: { OriginalDeadline: "asc" },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = mandates.map((m: any) => ({
        "Job ID":                 m.JobID,
        "Mandate Name":           m.JobName,
        "Client Name":            m.Client?.ClientName ?? "",
        "Client Jurisdiction":    m.Client?.ClientJurisdiction ?? "",
        "Client FYE":             m.Client?.ClientFYEDate ? new Date(m.Client.ClientFYEDate).toISOString().split("T")[0] : "",
        "FYE":                    m.FYE ? new Date(m.FYE).toISOString().split("T")[0] : "",
        "Tax Year":               m.TaxYear,
        "Form Type":              m.FormType,
        "Entity Type":            m.EntityType,
        "Country":                m.Country ?? "",
        "Jurisdiction":           m.Jurisdiction ?? "",
        "Service Line":           m.ServiceLine?.ServiceLine ?? "",
        "Client Partner":         m.ClientPartner?.PartnerName ?? "",
        "Mandate Partner":        m.MandatePartner?.PartnerName ?? "",
        "Mandate Manager":        m.MandateManager?.ManagerName ?? "",
        "Client Manager":         m.ClientManager?.ManagerName ?? "",
        "Assigned Staff":         m.AssignedStaff ? `${m.AssignedStaff.FirstName} ${m.AssignedStaff.LastName}` : "",
        "Assisting Staff":        m.AssistingStaff ? `${m.AssistingStaff.FirstName} ${m.AssistingStaff.LastName}` : "",
        "Current Stage":          m.CurrentStage?.CurrentStage ?? "",
        "Budget":                 m.Budget ?? "",
        "Client Commitment Date": m.ClientCommitmentDate ? new Date(m.ClientCommitmentDate).toISOString().split("T")[0] : "",
        "Internal Due Date":      m.StaffDueDate ? new Date(m.StaffDueDate).toISOString().split("T")[0] : "",
        "Legal Due Date":         m.OriginalDeadline ? new Date(m.OriginalDeadline).toISOString().split("T")[0] : "",
        "Extended Due Date":      m.ExtensionDeadline ? new Date(m.ExtensionDeadline).toISOString().split("T")[0] : "",
        "Disaster Due Date":      m.DisasterDeadline ? new Date(m.DisasterDeadline).toISOString().split("T")[0] : "",
        "Extension Filed":        m.ExtensionFiled ? "Yes" : "No",
        "Extension Filed Date":   m.ExtensionFiledDate ? new Date(m.ExtensionFiledDate).toISOString().split("T")[0] : "",
        "Date Return Filed":      m.Completion ? new Date(m.Completion).toISOString().split("T")[0] : "",
      }))

      return NextResponse.json({ type: "mandates", rows })
    }

    if (type === "clients") {
      const clients = await prisma.tblClient.findMany({
        where: { IsActive: true },
        orderBy: { ClientName: "asc" },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = clients.map((c: any) => ({
        "Client ID":    c.ClientID,
        "Client Name":  c.ClientName,
        "Jurisdiction": c.ClientJurisdiction,
        "FYE Date":     c.ClientFYEDate ? new Date(c.ClientFYEDate).toISOString().split("T")[0] : "",
        "Entity Type":  c.EntityType ?? "",
        "State":        c.ClientState ?? "",
        "County":       c.ClientCounty ?? "",
        "Zip Code":     c.ClientZipCode ?? "",
        "Priority":     c.Priority ?? "",
      }))

      return NextResponse.json({ type: "clients", rows })
    }

    if (type === "staff") {
      const staff = await prisma.tblStaff.findMany({
        where: { IsActive: true },
        orderBy: [{ LastName: "asc" }, { FirstName: "asc" }],
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = staff.map((s: any) => ({
        "Staff ID":   s.StaffID,
        "First Name": s.FirstName,
        "Last Name":  s.LastName,
        "Email":      s.Email,
        "Role":       s.Role,
        "Team":       s.Team ?? "",
        "Mon Hours":  s.UnitsMonday,
        "Tue Hours":  s.UnitsTuesday,
        "Wed Hours":  s.UnitsWednesday,
        "Thu Hours":  s.UnitsThursday,
        "Fri Hours":  s.UnitsFriday,
      }))

      return NextResponse.json({ type: "staff", rows })
    }

    return NextResponse.json({ error: "Invalid export type" }, { status: 400 })

  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}