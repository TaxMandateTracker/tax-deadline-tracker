import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN
    const GITHUB_OWNER = "crowescheduling-prog"
    const GITHUB_REPO  = "crowe-scheduling"
    const WORKFLOW_ID  = "update-tax-calendar.yml"

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/runs?per_page=1`,
      {
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
        },
      }
    )

    const data = await response.json()
    const latestRun = data.workflow_runs?.[0]

    if (!latestRun) {
      return NextResponse.json({ status: "unknown" })
    }

    return NextResponse.json({
      status:     latestRun.status,
      conclusion: latestRun.conclusion,
      createdAt:  latestRun.created_at,
      updatedAt:  latestRun.updated_at,
      url:        latestRun.html_url,
    })
  } catch (error) {
    console.error("Error checking workflow status:", error)
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}