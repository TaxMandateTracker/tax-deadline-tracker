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

    const staff = await prisma.tblStaff.findMany({
      where: { IsActive: true },
      orderBy: [
        { LastName:  "asc" },
        { FirstName: "asc" },
      ],
      select: {
        StaffID:        true,
        FirstName:      true,
        LastName:       true,
        Email:          true,
        Role:           true,
        Team:           true,
        UnitsMonday:    true,
        UnitsTuesday:   true,
        UnitsWednesday: true,
        UnitsThursday:  true,
        UnitsFriday:    true,
        IsActive:       true,
      },
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    )
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

    const staff = await prisma.tblStaff.create({
      data: {
        FirstName:      body.FirstName,
        LastName:       body.LastName,
        Email:          body.Email,
        Role:           body.Role,
        Team:           body.Team ?? null,
        UnitsSunday:    body.UnitsSunday    ?? 0,
        UnitsMonday:    body.UnitsMonday    ?? 8,
        UnitsTuesday:   body.UnitsTuesday   ?? 8,
        UnitsWednesday: body.UnitsWednesday ?? 8,
        UnitsThursday:  body.UnitsThursday  ?? 8,
        UnitsFriday:    body.UnitsFriday    ?? 8,
        UnitsSaturday:  body.UnitsSaturday  ?? 0,
      },
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error creating staff:", error)
    return NextResponse.json(
      { error: "Failed to create staff" },
      { status: 500 }
    )
  }
}