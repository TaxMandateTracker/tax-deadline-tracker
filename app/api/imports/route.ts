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

function getCountry(jurisdiction: string): string {
  const val = (jurisdiction ?? "").toLowerCase().trim()
  const canadianProvinces = [
    "ontario", "quebec", "british columbia", "alberta",
    "manitoba", "saskatchewan", "nova scotia",
    "new brunswick", "newfoundland", "pei",
    "prince edward island", "northwest territories",
    "nunavut", "yukon", "canada"
  ]
  if (canadianProvinces.some(p => val.includes(p))) return "Canada"
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
            const country = getCountry(jurisdiction)
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
        const jobName    = `${clientName} - ${formMapped} - ${taxYear}`

        const existingJob = await prisma.tblJob.findFirst({
          where: {
            ClientID: clientID,
            FormType: formMapped,
            TaxYear:  taxYear,
          },
        })

        if (existingJob) {
          results.skipped++
          results.details.push(`${jobName} — skipped (already exists)`)
          continue
        }

        const country        = getCountry(jurisdiction)
        const jurisdictionVal = isFederal(jurisdiction) ? "Federal" : jurisdiction

        await prisma.tblJob.create({
          data: {
            ClientID:          clientID,
            JobName:           jobName,
            FYE:               parseDate(fye) ?? new Date(),
            TaxYear:           taxYear,
            FormType:          formMapped,
            EntityType:        mapEntityType(entityType),
            Country:           country,
            Jurisdiction:      jurisdictionVal,
            CurrentStageID:    defaultStage?.CurrentStageID ?? null,
            ServiceLineID:     defaultServiceLine?.ServiceLineID ?? null,
            ExtensionFiledDate: parseDate(row["date extension filed"]),
            ExtensionFiled:    !!parseDate(row["date extension filed"]),
            Completion:        parseDate(row["date return filed"]),
            StaffDueDate:      parseDate(row["expected/internal due date"]),
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