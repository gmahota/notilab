import { NextResponse } from "next/server"
import { checkAdminAuth } from "@/lib/admin-auth"
import { getOverviewStats } from "@/lib/admin/overview"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await getOverviewStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error("[admin/overview]", err)
    return NextResponse.json(
      { error: "Failed to load overview stats" },
      { status: 500 },
    )
  }
}
