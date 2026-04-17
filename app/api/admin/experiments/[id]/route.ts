import { NextResponse } from "next/server"
import { checkAdminAuth } from "@/lib/admin-auth"
import { getExperimentResults } from "@/lib/admin/experiment-results"
import { stopExperiment, resetAssignments } from "@/lib/growth/experiments"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type PrismaExt = typeof prisma & {
  growthExperiment: {
    findUnique: (a: Record<string, unknown>) => Promise<{ id: string; name: string; isActive: boolean } | null>
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
    delete: (a: { where: { id: string } }) => Promise<unknown>
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/experiments/[id] — full funnel results for one experiment
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const results = await getExperimentResults(id)

  if (!results) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 })
  }

  return NextResponse.json(results)
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/experiments/[id] — update description or stop experiment
//
// Body: { action: "stop" | "reset" | "update", description?: string }
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { action, description } = (body ?? {}) as Record<string, unknown>

  if (action === "stop") {
    const result = await stopExperiment(id)
    return NextResponse.json(result)
  }

  if (action === "reset") {
    const result = await resetAssignments(id)
    return NextResponse.json(result)
  }

  if (action === "update" && typeof description === "string") {
    const db = prisma as unknown as PrismaExt
    const result = await db.growthExperiment.update({
      where: { id },
      data: { description },
    })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/experiments/[id] — delete experiment + all assignments
// Only allowed when experiment is inactive
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = prisma as unknown as PrismaExt

  const exp = await db.growthExperiment.findUnique({ where: { id } })
  if (!exp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (exp.isActive) {
    return NextResponse.json(
      { error: "Stop the experiment before deleting it" },
      { status: 409 },
    )
  }

  await db.growthExperiment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
