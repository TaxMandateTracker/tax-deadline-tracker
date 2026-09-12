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

    const stages = await prisma.tblCurrentStage.findMany({
      where: { IsActive: true },
      orderBy: { SortOrder: "asc" },
    })

    return NextResponse.json(stages)
  } catch (error) {
    console.error("Error fetching stages:", error)
    return NextResponse.json({ error: "Failed to fetch stages" }, { status: 500 })
  }
}