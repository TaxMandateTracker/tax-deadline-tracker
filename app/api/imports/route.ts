import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function mapEntityType(raw: string): string {
  const val = (raw ?? "").toLowerCase().trim()
  if (val.includes("s corp"))       return "S-Corporation"
  if (val.includes("partnership"))  return "Partnership"
  if (val.includes("c corp"))       return "C-Corporation"
  if (val.includes("individual"))   return "Individual"
  if (val.includes("trust"))        return "Trust/Estate"
  if (val.includes("non-profit") || val.includes("nonprofit")) return "Non-profit"
  if (val.includes("llc"))          return "Partnership"
  return raw
}

function mapFormType(raw: string): string {
  const val = (raw ?? "").trim()
  if (val === "1120-S") return "1120S"
  if (val === "1120-F") return "1120F"
  return val
}

function getCountry(formType: string): string {
  const f = (formType ?? "").toUpperCase().trim()
  if (
    f.startsWith("T1") ||
    f.startsWith("T2") ||
    f.startsWith("T3") ||
    f.startsWith("T4") ||
    f === "GST/HST" ||
    f === "T3010"
  ) return "Canada"
  return "US"
}

function isFederal(jurisdiction: string): boolean {
  return (jurisdiction ?? "").toLowerCase().trim() === "federal"
}

function parseDate(val: string | null | undefined): Date | null {
  if (!val || val === "NaN" || val.trim() === "" || val === "undefined") return null
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

function parseTaxYear(fye: string | null): number {
  if (!fye) return new Date().getFullYear()
  try {
    return new Date(fye).getFullYear()
  } catch {
    return new Date().getFullYear()
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const rows: Record<string, string>[] = body.rows

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 })
    }

    const results = {
      total:          rows.length,
      imported:       0,
      skipped:        0,
      errors:         0,
      clientsCreated: 0,
      details:        [] as string[],
    }

    const defaultStage = await prisma.tblCurrentStage.findFirst({
      where: { CurrentStage: "Preparation & Analysis" },
    })

    const defaultServiceLine = await prisma.tblServiceLine.findFirst({
      where: { ServiceLine: "US Tax" },
    })

    const clientCache: Record<string, number> = {}

        const staffCache: Record<string, number> = {}

    // Helper to get or create staff by name
    async function getOrCreateStaff(fullName: string): Promise<number | null> {
      if (!fullName || fullName.trim() === "" || fullName === "NaN") return null
      
      const key = fullName.toLowerCase().trim()
      if (staffCache[key]) return staffCache[key]

      const nameParts = fullName.trim().split(" ")
      const firstName = nameParts[0] ?? ""
      const lastName  = nameParts.slice(1).join(" ") || firstName

      // Check existing staff
      const existing = await prisma.tblStaff.findFirst({
        where: {
          OR: [
            {
              FirstName: { equals: firstName, mode: "insensitive" },
              LastName:  { equals: lastName,  mode: "insensitive" },
            },
            {
              FirstName: { equals: fullName.trim(), mode: "insensitive" },
            },
          ],
        },
      })

      if (existing) {
        staffCache[key] = existing.StaffID
        return existing.StaffID
      }

      // Create new staff
      const created = await prisma.tblStaff.create({
        data: {
          FirstName: firstName,
          LastName:  lastName,
          Email:     `${firstName.toLowerCase()}.${lastName.toLowerCase()}@firm.com`,
          Role:      "Associate",
        },
      })

      staffCache[key] = created.StaffID
      results.details.push(`Staff created: ${fullName}`)
      return created.StaffID
    }

    for (const row of rows) {
      try {
        const clientName   = (row["client name"] || "").trim()
        const formNumber   = (row["form number"] || "").trim()
        const fye          = row["financial year-end"] || ""
        const jurisdiction = row["jurisdiction"] || "Federal"
        const entityType   = row["entity type"] || ""

        if (!clientName) {
          results.skipped++
          continue
        }

        if (!formNumber || formNumber === "NaN" || formNumber === "") {
          results.skipped++
          results.details.push(`${clientName} — skipped (no form number)`)
          continue
        }

        if (formNumber.toUpperCase().startsWith("F-")) {
          results.skipped++
          results.details.push(`${clientName} — skipped (state form: ${formNumber})`)
          continue
        }

        let clientID = clientCache[clientName.toLowerCase()]

        if (!clientID) {
          const existing = await prisma.tblClient.findFirst({
            where: { ClientName: { equals: clientName, mode: "insensitive" } },
          })

          if (existing) {
            clientID = existing.ClientID
          } else {
            const country = getCountry(mapFormType(formNumber))
            const created = await prisma.tblClient.create({
              data: {
                ClientName:         clientName,
                ClientJurisdiction: country,
                ClientFYEDate:      parseDate(fye),
                EntityType:         mapEntityType(entityType),
              },
            })
            clientID = created.ClientID
            results.clientsCreated++
            results.details.push(`Client created: ${clientName}`)
          }

          clientCache[clientName.toLowerCase()] = clientID
        }

        const formMapped = mapFormType(formNumber)
        const taxYear    = parseTaxYear(fye)
        const fyeDate    = parseDate(fye)
        const fyeDateStr = fyeDate instanceof Date ? fyeDate.toISOString().split("T")[0] : String(taxYear)
        const jobName    = `${clientName} - ${formMapped} - ${fyeDateStr}`

        const existingJob = await prisma.tblJob.findFirst({
          where: {
           JobName: jobName,
         },
      })

        if (existingJob) {
          results.skipped++
          results.details.push(`${jobName} — skipped (already exists)`)
          continue
        }

        const country        = getCountry(formMapped)
        const jurisdictionVal = isFederal(jurisdiction) ? "Federal" : jurisdiction

                // Get or create staff from Excel columns
        const assignedStaffID  = await getOrCreateStaff(row["mandate preparer"]  || "")
        const assignedStaffID2 = await getOrCreateStaff(row["mandate manager"]   || "")
        const assignedStaffID3 = await getOrCreateStaff(row["client manager"]    || "")
        const assignedStaffID4 = await getOrCreateStaff(row["mandate partner"]   || "")
        const assignedStaffID5 = await getOrCreateStaff(row["client partner"]    || "")

        // Look up manager records
        const mandateManager = assignedStaffID2
          ? await prisma.tblManager.findFirst({ where: { StaffID: assignedStaffID2 } })
          : null

        const clientManager = assignedStaffID3
          ? await prisma.tblManager.findFirst({ where: { StaffID: assignedStaffID3 } })
          : null

        // Look up partner records
        const mandatePartner = assignedStaffID4
          ? await prisma.tblPartner.findFirst({ where: { StaffID: assignedStaffID4 } })
          : null

        const clientPartner = assignedStaffID5
          ? await prisma.tblPartner.findFirst({ where: { StaffID: assignedStaffID5 } })
          : null

                // Look up deadline from TblTaxCalendar
        let originalDeadline  = null
        let extensionDeadline = null

        if (fyeDate && formMapped) {
          const calendarEntry = await prisma.tblTaxCalendar.findFirst({
            where: {
              FormType:         formMapped,
              Jurisdiction:     jurisdictionVal,
              DisasterEligible: "No",
              FYE: {
                gte: new Date(fyeDate.getFullYear(), fyeDate.getMonth(), 1),
                lte: new Date(fyeDate.getFullYear(), fyeDate.getMonth() + 1, 0),
              },
            },
            orderBy: { FYE: "asc" },
          })

          if (calendarEntry) {
            originalDeadline  = calendarEntry.OriginalDeadline
            extensionDeadline = calendarEntry.ExtensionDeadline
          }
        }

        await prisma.tblJob.create({
          data: {
            ClientID:           clientID,
            JobName:            jobName,
            FYE:                fyeDate ?? new Date(),
            TaxYear:            taxYear,
            FormType:           formMapped,
            EntityType:         mapEntityType(entityType),
            Country:            country,
            Jurisdiction:       jurisdictionVal,
            CurrentStageID:     defaultStage?.CurrentStageID ?? null,
            ServiceLineID:      defaultServiceLine?.ServiceLineID ?? null,
            ExtensionFiledDate: parseDate(row["date extension filed"]),
            ExtensionFiled:     !!parseDate(row["date extension filed"]),
            Completion:         parseDate(row["date return filed"]),
            StaffDueDate:       parseDate(row["expected/internal due date"]),
            AssignedStaffID:    assignedStaffID,
            MandateManagerID:   mandateManager?.ManagerID ?? null,
            ClientManagerID:    clientManager?.ManagerID ?? null,
            MandatePartnerID:   mandatePartner?.PartnerID ?? null,
            ClientPartnerID:    clientPartner?.PartnerID ?? null,
            OriginalDeadline:   originalDeadline,
            ExtensionDeadline:  extensionDeadline,
          },
        })
        
        results.imported++
        results.details.push(`✅ Imported: ${jobName}`)

      } catch (rowError) {
        results.errors++
        results.details.push(`❌ Error: ${rowError}`)
      }
    }

    return NextResponse.json(results)

  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}