import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const partners = await prisma.tblPartner.findMany({
      where: { IsActive: true },
      orderBy: { PartnerName: "asc" },
    })

    return NextResponse.json(partners)
  } catch (error) {
    console.error("Error fetching partners:", error)
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 })
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

    // Check if already a partner
    const existing = await prisma.tblPartner.findFirst({
      where: { StaffID: body.StaffID },
    })

    if (existing) {
      return NextResponse.json({ error: "Staff member is already a partner" }, { status: 400 })
    }

    const partner = await prisma.tblPartner.create({
      data: {
        StaffID:     body.StaffID,
        PartnerName: body.PartnerName,
        Email:       body.Email,
        IsActive:    true,
      },
    })

    return NextResponse.json(partner)
  } catch (error) {
    console.error("Error creating partner:", error)
    return NextResponse.json({ error: "Failed to create partner" }, { status: 500 })
  }
}