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

    const clients = await prisma.tblClient.findMany({
      where: { IsActive: true },
      orderBy: { ClientName: "asc" },
      select: {
        ClientID:           true,
        ClientName:         true,
        ClientJurisdiction: true,
        ClientFYEDate:      true,
        ClientState:        true,
        ClientCounty:       true,
        ClientZipCode:      true,
        EntityType:         true,
        Priority:           true,
        IsActive:           true,
      },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json(
      { error: "Failed to fetch clients" },
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

    const client = await prisma.tblClient.create({
      data: {
        ClientName:         body.ClientName,
        ClientJurisdiction: body.ClientJurisdiction,
        ClientFYEDate:      body.ClientFYEDate ? new Date(body.ClientFYEDate) : null,
        ClientState:        body.ClientState ?? null,
        ClientCounty:       body.ClientCounty ?? null,
        ClientZipCode:      body.ClientZipCode ?? null,
        EntityType:         body.EntityType ?? null,
        Priority:           body.Priority ?? null,
      },
    })

    return NextResponse.json(client)
  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}