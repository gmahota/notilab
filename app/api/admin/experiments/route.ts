import { NextResponse } from "next/server"
import { checkAdminAuth } from "@/lib/admin-auth"
import { listExperimentSummaries, getExperimentResults } from "@/lib/admin/experiment-results"
import { createExperiment } from "@/lib/growth/experiments"

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// GET /api/admin/experiments — list all experiments with summary stats
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const summaries = await listExperimentSummaries()
  return NextResponse.json(summaries)
}

// ---------------------------------------------------------------------------
// POST /api/admin/experiments — create a new experiment
//
// Body: {
//   name: string           // unique slug, e.g. "hero_copy_v2"
//   description?: string
//   variants: {
//     [variantName]: {
//       weight?: number    // defaults to 1 (equal split)
//       label?: string     // human label for dashboard
//       [key]: unknown     // arbitrary payload: copy strings, flags, etc.
//     }
//   }
// }
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const user = await checkAdminAuth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, description, variants } = (body ?? {}) as Record<string, unknown>

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  if (
    !variants ||
    typeof variants !== "object" ||
    Array.isArray(variants) ||
    Object.keys(variants as object).length < 2
  ) {
    return NextResponse.json(
      { error: "variants must be an object with at least 2 keys (include 'control')" },
      { status: 400 },
    )
  }

  if (!("control" in (variants as object))) {
    return NextResponse.json(
      { error: "variants must include a 'control' key" },
      { status: 400 },
    )
  }

  try {
    const experiment = await createExperiment({
      name: name.trim(),
      description: typeof description === "string" ? description : undefined,
      variants: variants as Record<string, { weight?: number; label?: string }>,
    })
    return NextResponse.json(experiment, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Experiment name already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 })
  }
}
