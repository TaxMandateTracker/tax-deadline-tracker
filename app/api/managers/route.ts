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

    const managers = await prisma.tblManager.findMany({
      where: { IsActive: true },
      orderBy: { ManagerName: "asc" },
    })

    return NextResponse.json(managers)
  } catch (error) {
    console.error("Error fetching managers:", error)
    return NextResponse.json({ error: "Failed to fetch managers" }, { status: 500 })
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

    // Check if already a manager
    const existing = await prisma.tblManager.findFirst({
      where: { StaffID: body.StaffID },
    })

    if (existing) {
      return NextResponse.json({ error: "Staff member is already a manager" }, { status: 400 })
    }

    const manager = await prisma.tblManager.create({
      data: {
        StaffID:     body.StaffID,
        ManagerName: body.ManagerName,
        Email:       body.Email,
        IsActive:    true,
      },
    })

    return NextResponse.json(manager)
  } catch (error) {
    console.error("Error creating manager:", error)
    return NextResponse.json({ error: "Failed to create manager" }, { status: 500 })
  }
}