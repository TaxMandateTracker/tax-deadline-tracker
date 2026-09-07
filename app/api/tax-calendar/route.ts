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
    const taxYear     = searchParams.get("taxYear")
    const jurisdiction = searchParams.get("jurisdiction")
    const formType    = searchParams.get("formType")

    const where: Record<string, unknown> = {}
    if (taxYear)      where.TaxYear      = parseInt(taxYear)
    if (jurisdiction) where.Jurisdiction = jurisdiction
    if (formType)     where.FormType     = formType

    const records = await prisma.tblTaxCalendar.findMany({
      where,
      orderBy: [
        { OriginalDeadline: "asc" },
        { FormType: "asc" },
      ],
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error("Error fetching tax calendar:", error)
    return NextResponse.json(
      { error: "Failed to fetch tax calendar" },
      { status: 500 }
    )
  }
}