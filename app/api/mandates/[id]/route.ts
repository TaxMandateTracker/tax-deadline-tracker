import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId   = parseInt(id)
    const body    = await request.json()

    // Get current job for audit trail
    const currentJob = await prisma.tblJob.findUnique({
      where: { JobID: jobId },
    })

    if (!currentJob) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 })
    }

    // Get current user staff record
    const staffMember = await prisma.tblStaff.findFirst({
      where: { Email: user.email ?? "" },
    })

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.CurrentStageID   !== undefined) updateData.CurrentStageID   = body.CurrentStageID
    if (body.AssignedStaffID  !== undefined) updateData.AssignedStaffID  = body.AssignedStaffID
    if (body.AssistingStaffID !== undefined) updateData.AssistingStaffID = body.AssistingStaffID
    if (body.Budget           !== undefined) updateData.Budget           = body.Budget
    if (body.ExtensionFiled   !== undefined) updateData.ExtensionFiled   = body.ExtensionFiled
    if (body.ExtensionFiledDate !== undefined) updateData.ExtensionFiledDate = body.ExtensionFiledDate ? new Date(body.ExtensionFiledDate) : null
    if (body.DeadlineType     !== undefined) updateData.DeadlineType     = body.DeadlineType
    if (body.ClientCommitmentDate !== undefined) updateData.ClientCommitmentDate = body.ClientCommitmentDate ? new Date(body.ClientCommitmentDate) : null
    if (body.StaffDueDate     !== undefined) updateData.StaffDueDate     = body.StaffDueDate ? new Date(body.StaffDueDate) : null
    if (body.ClientPartnerID  !== undefined) updateData.ClientPartnerID  = body.ClientPartnerID
    if (body.MandatePartnerID !== undefined) updateData.MandatePartnerID = body.MandatePartnerID
    if (body.MandateManagerID !== undefined) updateData.MandateManagerID = body.MandateManagerID
    if (body.ClientManagerID  !== undefined) updateData.ClientManagerID  = body.ClientManagerID
    if (body.ServiceLineID    !== undefined) updateData.ServiceLineID    = body.ServiceLineID

    // Update TblJob
    const updated = await prisma.tblJob.update({
      where: { JobID: jobId },
      data:  updateData,
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
    })

    // Write audit trail for deadline changes
    const deadlineFields = [
      { field: "StaffDueDate",          old: currentJob.StaffDueDate,          new: updateData.StaffDueDate },
      { field: "ClientCommitmentDate",   old: currentJob.ClientCommitmentDate,  new: updateData.ClientCommitmentDate },
      { field: "DeadlineType",           old: currentJob.DeadlineType,          new: updateData.DeadlineType },
    ]

    for (const df of deadlineFields) {
      if (df.new !== undefined && String(df.old) !== String(df.new)) {
        await prisma.tblDueDateAuditTrail.create({
          data: {
            JobID:        jobId,
            ClientID:     currentJob.ClientID,
            FieldChanged: df.field,
            OldValue:     df.old ? String(df.old) : null,
            NewValue:     df.new ? String(df.new) : null,
            ChangeType:   body.ChangeType ?? "InternalChange",
            ChangeReason: body.ChangeReason ?? null,
            ChangedBy:    staffMember?.StaffID ?? null,
            ChangedDate:  new Date(),
            CreatedBy:    staffMember?.StaffID ?? null,
            CreatedDate:  new Date(),
          },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating mandate:", error)
    return NextResponse.json(
      { error: "Failed to update mandate" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId   = parseInt(id)

    const mandate = await prisma.tblJob.findUnique({
      where: { JobID: jobId },
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
        AuditTrail: {
          orderBy: { CreatedDate: "desc" },
          take: 10,
          include: {
            ChangedByStaff: {
              select: { FirstName: true, LastName: true }
            },
          },
        },
      },
    })

    if (!mandate) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 })
    }

    return NextResponse.json(mandate)
  } catch (error) {
    console.error("Error fetching mandate:", error)
    return NextResponse.json(
      { error: "Failed to fetch mandate" },
      { status: 500 }
    )
  }
}