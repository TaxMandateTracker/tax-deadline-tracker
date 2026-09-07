import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DEFAULT_PERMISSIONS = {
  canSeeFees: true,
  canSeeEAC: true,
  canSeeBillableRate: true,
  canSeeCostRate: true,
  canSeeProfitMargin: true,
  canSeeStaffRates: true,
  canSeeStaffSalaries: true,
  canSeeClientFees: true,
  canSeeAllStaff: true,
  canSeeUtilization: true,
  canExportData: true,
  canSeeReports: true,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Look up staff record by email
    const staffMember = await prisma.tblStaff.findFirst({
      where: {
        Email: user.email ?? "",
      },
    })

    if (!staffMember) {
      // User not in TblStaff — treat as owner/Partner
      return NextResponse.json({
        id: null,
        fullName: user.email?.split("@")[0] ?? "User",
        email: user.email,
        role: "Partner",
        isOwner: true,
        permissions: DEFAULT_PERMISSIONS,
      })
    }

    return NextResponse.json({
      id: staffMember.StaffID,
      fullName: `${staffMember.FirstName} ${staffMember.LastName}`,
      email: staffMember.Email,
      role: staffMember.Role,
      isOwner: false,
      permissions: DEFAULT_PERMISSIONS,
    })
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}