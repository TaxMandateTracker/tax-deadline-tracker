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
    const view = searchParams.get("view") ?? "active"

    // Build stage filter based on view
    let stageFilter = {}
    if (view === "active") {
      stageFilter = {
        CurrentStage: {
          IsPipeline:  false,
          IsCompleted: false,
          IsLost:      false,
        }
      }
    } else if (view === "pipeline") {
      stageFilter = { CurrentStage: { IsPipeline: true } }
    } else if (view === "completed") {
      stageFilter = { CurrentStage: { IsCompleted: true } }
    } else if (view === "lost") {
      stageFilter = { CurrentStage: { IsLost: true } }
    }

    const mandates = await prisma.tblJob.findMany({
      where: {
        IsActive: true,
        ...stageFilter,
      },
      include: {
        Client: {
          select: {
            ClientID:          true,
            ClientName:        true,
            ClientJurisdiction: true,
            ClientFYEDate:     true,
            ClientState:       true,
            ClientCounty:      true,
            ClientZipCode:     true,
            EntityType:        true,
          },
        },
        ServiceLine: {
          select: {
            ServiceLineID: true,
            ServiceLine:   true,
          },
        },
        ClientPartner: {
          select: {
            PartnerID:   true,
            PartnerName: true,
            Email:       true,
          },
        },
        MandatePartner: {
          select: {
            PartnerID:   true,
            PartnerName: true,
            Email:       true,
          },
        },
                MandateManager: {
          select: {
            ManagerID:   true,
            ManagerName: true,
            Email:       true,
          },
        },
        ClientManager: {
          select: {
            ManagerID:   true,
            ManagerName: true,
            Email:       true,
          },
        },
        AssignedStaff: {
          select: {
            StaffID:   true,
            FirstName: true,
            LastName:  true,
            Email:     true,
          },
        },
        AssistingStaff: {
          select: {
            StaffID:   true,
            FirstName: true,
            LastName:  true,
            Email:     true,
          },
        },
        CurrentStage: {
          select: {
            CurrentStageID: true,
            CurrentStage:   true,
            IsPipeline:     true,
            IsCompleted:    true,
            IsLost:         true,
          },
        },
        AuditTrail: {
          orderBy: { CreatedDate: "asc" },
          take: 1,
          select: {
            CreatedDate:   true,
            CreatedByStaff: {
              select: {
                FirstName: true,
                LastName:  true,
              },
            },
          },
        },
      },
      orderBy: [
        { OriginalDeadline: "asc" },
        { Client: { ClientName: "asc" } },
      ],
    })

    // For each mandate look up deadlines from TblTaxCalendar
    const enriched = await Promise.all(
      mandates.map(async (mandate) => {
        let taxCalendar = null

        if (mandate.FormType && mandate.FYE) {
          const fye = new Date(mandate.FYE)

          taxCalendar = await prisma.tblTaxCalendar.findFirst({
            where: {
              FormType:     mandate.FormType,
              Jurisdiction: mandate.Jurisdiction ?? "Federal",
              FYE: {
                gte: new Date(fye.getFullYear(), fye.getMonth(), 1),
                lte: new Date(fye.getFullYear(), fye.getMonth() + 1, 0),
              },
              DisasterEligible: "No",
            },
            orderBy: { FYE: "asc" },
          })

          // Check for disaster deadline if client has state
          let disasterCalendar = null
          if (mandate.Client?.ClientState) {
            disasterCalendar = await prisma.tblTaxCalendar.findFirst({
              where: {
                FormType:         mandate.FormType,
                Jurisdiction:     mandate.Jurisdiction,
                DisasterEligible: "Yes",
                DisasterLocation: mandate.Client.ClientState,
                FYE: {
                  gte: new Date(fye.getFullYear(), fye.getMonth(), 1),
                  lte: new Date(fye.getFullYear(), fye.getMonth() + 1, 0),
                },
              },
              orderBy: { FYE: "asc" },
            })
          }

          return {
            ...mandate,
            LegalDueDate:     taxCalendar?.OriginalDeadline  ?? mandate.OriginalDeadline,
            ExtendedDueDate:  taxCalendar?.ExtensionDeadline ?? mandate.ExtensionDeadline,
            DisasterDueDate:  disasterCalendar?.DisasterDeadline ?? null,
            DisasterName:     disasterCalendar?.DisasterName ?? null,
            DisasterLocation: disasterCalendar?.DisasterLocation ?? null,
            DisasterCounties: disasterCalendar?.DisasterCounties ?? null,
          }
        }

        return {
          ...mandate,
          LegalDueDate:    mandate.OriginalDeadline,
          ExtendedDueDate: mandate.ExtensionDeadline,
          DisasterDueDate: null,
          DisasterName:    null,
          DisasterLocation: null,
          DisasterCounties: null,
        }
      })
    )

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching mandates:", error)
    return NextResponse.json(
      { error: "Failed to fetch mandates" },
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

    const mandate = await prisma.tblJob.create({
      data: {
        ClientID:            body.ClientID,
        JobName:             body.JobName,
        FYE:                 new Date(body.FYE),
        TaxYear:             body.TaxYear,
        FormType:            body.FormType,
        EntityType:          body.EntityType,
        Jurisdiction:        body.Jurisdiction,
        ServiceLineID:       body.ServiceLineID ?? null,
        ClientPartnerID:     body.ClientPartnerID ?? null,
        MandatePartnerID:    body.MandatePartnerID ?? null,
        MandateManagerID:    body.MandateManagerID ?? null,
        ClientManagerID:     body.ClientManagerID ?? null,
        AssignedStaffID:     body.AssignedStaffID ?? null,
        AssistingStaffID:    body.AssistingStaffID ?? null,
        CurrentStageID:      body.CurrentStageID ?? null,
        Budget:              body.Budget ?? null,
        ClientCommitmentDate: body.ClientCommitmentDate
          ? new Date(body.ClientCommitmentDate)
          : null,
        StaffDueDate:     body.InternalDueDate
          ? new Date(body.InternalDueDate)
          : null,
      },
      include: {
        Client:        true,
        ServiceLine:   true,
        ClientPartner: true,
        MandatePartner:true,
        MandateManager: true,
        ClientManager:  true,
        AssignedStaff: true,
        AssistingStaff:true,
        CurrentStage:  true,
      },
    })

    return NextResponse.json(mandate)
  } catch (error) {
    console.error("Error creating mandate:", error)
    return NextResponse.json(
      { error: "Failed to create mandate" },
      { status: 500 }
    )
  }
}