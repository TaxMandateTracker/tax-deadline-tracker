import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const year = body.year || new Date().getFullYear()

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN
    const GITHUB_OWNER = "TaxMandateTracker"
    const GITHUB_REPO  = "tax-deadline-tracker"
    const WORKFLOW_ID  = "update-tax-calendar.yml"

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "GitHub token not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            year: year.toString(),
          },
        }),
      }
    )

    if (response.status === 204) {
      return NextResponse.json({
        success: true,
        message: `Tax calendar update triggered for ${year}`,
        year,
      })
    } else {
      const error = await response.text()
      return NextResponse.json(
        { error: `GitHub API error: ${error}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error triggering workflow:", error)
    return NextResponse.json(
      { error: "Failed to trigger workflow" },
      { status: 500 }
    )
  }
}